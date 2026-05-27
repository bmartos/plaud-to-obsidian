import subprocess
import json
import os
import sys
import re
from datetime import datetime

# Add scripts directory to path to import db_manager
sys.path.append(os.path.join(os.path.dirname(__file__)))
import db_manager

def parse_duration(duration_str):
    """Parses duration like '16m33s' or '1h2m3s' into seconds."""
    seconds = 0
    match = re.search(r'(\d+)h', duration_str)
    if match: seconds += int(match.group(1)) * 3600
    match = re.search(r'(\d+)m', duration_str)
    if match: seconds += int(match.group(1)) * 60
    match = re.search(r'(\d+)s', duration_str)
    if match: seconds += int(match.group(1))
    return seconds

def sync_plaud_files(force_metadata=False):
    """
    Synchronizes the local SQLite database with the Plaud Cloud state.
    """
    print(f"Starting Plaud Cloud Sync (Force Metadata: {force_metadata})...")
    # Force UTF-8 for subprocess output
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    
    try:
        # 1. Get current file list from cloud
        result = subprocess.run(["plaud", "files", "-s", "100"], 
                               capture_output=True, text=True, check=True, shell=True, env=env)
        lines = result.stdout.splitlines()
        
        cloud_ids = []
        for line in lines:
            match = re.search(r'([a-f0-9]{32})', line)
            if match:
                cloud_ids.append(match.group(1))
        
        if not cloud_ids:
            print("No files found on Plaud Cloud.")
            return

        print(f"Found {len(cloud_ids)} files in cloud. Processing updates...")
        
        # Determine database path
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        db_path = os.path.join(project_root, 'data', 'plaud_records.db')
        conn = db_manager.init_db(db_path)
        
        stats = {"added": 0, "updated": 0, "skipped": 0, "errors": 0}

        import requests

        for file_id in cloud_ids:
            # Check local state
            local_record = db_manager.get_record(conn, file_id)
            
            # Fetch details if new or forced
            if not force_metadata and local_record:
                stats["skipped"] += 1
                continue
                
            print(f"  Syncing {file_id}...", end=" ", flush=True)
            detail_res = subprocess.run(["plaud", "file", file_id], 
                                       capture_output=True, shell=True, env=env)
            if detail_res.returncode != 0:
                print("[Error Fetching File]")
                stats["errors"] += 1
                continue
                
            # Decode manually as UTF-8 to preserve accents
            output = detail_res.stdout.decode('utf-8', errors='replace')
            
            def get_val(pattern):
                m = re.search(pattern, output)
                return m.group(1).strip() if m else None

            start_at_str = get_val(r'start_at:\s+(.*)')
            duration_str = get_val(r'duration:\s+(.*)')
            fullname = get_val(r'name:\s+(.*)')
            
            # Fix potential UTF-8 encoding issues in the capture
            if fullname:
                try:
                    # Some terminals might pipe garbled text; attempt to normalize if needed
                    # but usually 'text=True' with 'env' is enough.
                    pass
                except:
                    pass

            try:
                dt = datetime.fromisoformat(start_at_str.split('.')[0])
                timestamp = int(dt.timestamp())
            except:
                timestamp = 0

            # Get filesize from S3 URL headers without downloading
            filesize_bytes = 0
            audio_res = subprocess.run(["plaud", "audio", file_id], capture_output=True, text=True, shell=True)
            if audio_res.returncode == 0:
                url_match = re.search(r'(https?://[^\s\n]+)', audio_res.stdout)
                if url_match:
                    try:
                        h_res = requests.get(url_match.group(1), stream=True, timeout=5)
                        filesize_bytes = int(h_res.headers.get('Content-Length', 0))
                    except:
                        pass

            is_trans_cloud = 1 if get_val(r'transcript:\s+(.*)') == "available" else 0
            is_summary_cloud = 1 if get_val(r'summary:\s+(.*)') == "available" else 0

            payload = {
                "id": file_id,
                "fullname": fullname,
                "filesize": filesize_bytes, 
                "duration": parse_duration(duration_str),
                "start_time": timestamp,
                "is_trash": 0,
                "is_trans": is_trans_cloud,
                "is_summary": is_summary_cloud
            }
            
            if local_record:
                stats["updated"] += 1
            else:
                stats["added"] += 1
                
            db_manager.update_record(conn, payload)
            print("[OK]")
            
        conn.close()
        print(f"\nSync complete! Added: {stats['added']}, Updated: {stats['updated']}, Skipped: {stats['skipped']}, Errors: {stats['errors']}")
        
    except Exception as e:
        print(f"\nError during sync: {e}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Sync Plaud Recordings to Database")
    parser.add_argument("--force", action="store_true", help="Force update all metadata from cloud")
    args = parser.parse_args()
    
    sync_plaud_files(force_metadata=args.force)
