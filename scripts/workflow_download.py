import subprocess
import os
import sys
import re
import requests
from datetime import datetime

# Add scripts directory to path to import db_manager
sys.path.append(os.path.join(os.path.dirname(__file__)))
import db_manager

def sanitize_filename(name):
    clean = re.sub(r'[\\/*?:"<>|]', "-", name)
    clean = clean.replace(" ", "_")
    return clean

def get_target_filename(file_id, fullname, start_time_val, ext=".md"):
    if start_time_val:
        if isinstance(start_time_val, (int, float)):
            from datetime import datetime, timezone, timedelta
            dt = datetime.fromtimestamp(start_time_val, tz=timezone.utc)
            dt_brazil = dt - timedelta(hours=3)
            date_str = dt_brazil.strftime('%Y-%m-%d')
        elif isinstance(start_time_val, str):
            # If it's already a formatted string like 'YYYY-MM-DD HH:MM:SS'
            date_str = start_time_val.split(' ')[0]
        else:
            date_str = "1970-01-01"
    else:
        date_str = "1970-01-01"
    
    safe_name = sanitize_filename(fullname)
    return f"{date_str}_{safe_name}{ext}"

def download_audio(file_id, target_filename, output_dir):
    """Downloads a single audio file and returns its local path and size."""
    try:
        print(f"  Fetching download URL for {file_id}...")
        
        # Force UTF-8 environment
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        
        result = subprocess.run(["plaud", "audio", file_id], capture_output=True, shell=True, env=env)
        if result.returncode != 0:
            print(f"    [Error] Failed to get audio URL: {result.stderr.decode('utf-8', 'ignore')}")
            return None, 0
            
        output = result.stdout.decode('utf-8', 'ignore')
        
        # Match the S3 URL exactly (handles very long AWS signed URLs with query parameters)
        url_match = re.search(r'(https://plaud-bucket\.s3-accelerate\.amazonaws\.com/[^\s\n]+)', output)
        if not url_match:
            print(f"    [Error] URL not found in output. Output was:\n{output[:200]}...")
            return None, 0
            
        url = url_match.group(1)
        filepath = os.path.join(output_dir, target_filename)
        
        if os.path.exists(filepath):
            print(f"    [Skip] Audio already exists at {filepath}")
            return filepath, os.path.getsize(filepath)

        print(f"    Downloading to {filepath}...")
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        with open(filepath, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        filesize = os.path.getsize(filepath)
        return filepath, filesize
        
    except Exception as e:
        print(f"    [Error] Download failed: {e}")
        return None, 0

def download_asset(cmd_type, file_id, target_filename, output_dir):
    """Downloads transcript or summary asset directly as a markdown file."""
    try:
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, target_filename)
        
        if os.path.exists(filepath):
            print(f"    [Skip] {cmd_type} already exists at {filepath}")
            return filepath

        print(f"    Downloading {cmd_type} to {filepath}...")
        
        # Force UTF-8 for subprocess
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        
        result = subprocess.run(["plaud", cmd_type, file_id, "-o", filepath], 
                               capture_output=True, text=True, shell=True, env=env)
        if result.returncode == 0:
            return filepath
        else:
            print(f"    [Error] {cmd_type} download failed: {result.stderr}")
            return None
    except Exception as e:
        print(f"    [Error] {cmd_type} exception: {e}")
        return None

def workflow_sync_and_download(download_assets=False):
    """
    Core Workflow:
    1. Sync with Plaud Cloud.
    2. Identify recordings NOT in DB.
    3. Register them.
    4. IF download_assets is True: download ALL available assets (Audio, Transcript, Summary).
    """
    if download_assets:
        print("Starting Workflow: Unified Sync & Download")
    else:
        print("Starting Workflow: Metadata Sync Only")
    
    # Setup Environment
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(project_root, 'data', 'plaud_records.db')
    
    # Paths for internal storage (local audio)
    audio_dir = os.path.join(project_root, 'data', 'audio')
    
    # Target paths for Obsidian (direct publish)
    obsidian_root = os.path.join(os.path.dirname(project_root), 'Obsidian', 'plaud')
    obsidian_trans_dir = os.path.join(obsidian_root, 'transcription')
    obsidian_sum_dir = os.path.join(obsidian_root, 'summary')

    conn = db_manager.init_db(db_path)
    
    try:
        print("Fetching cloud files...")
        result = subprocess.run(["plaud", "files", "-s", "100"], capture_output=True, text=True, check=True, shell=True, env=env)
        cloud_ids = re.findall(r'([a-f0-9]{32})', result.stdout)
        
        print(f"Found {len(cloud_ids)} files in cloud.")
        
        stats = {"new": 0, "existing": 0, "downloaded": 0, "transcribed": 0, "analyzed": 0, "errors": 0}

        for file_id in cloud_ids:
            # Re-read from DB to check if registered
            record = db_manager.get_record(conn, file_id)
            if record:
                stats["existing"] += 1
                continue
            
            print(f"[*] Processing: {file_id}")
            stats["new"] += 1
            
            # Fetch full details
            detail_res = subprocess.run(["plaud", "file", file_id], capture_output=True, shell=True, env=env)
            if detail_res.returncode != 0:
                print(f"  [Error] Could not fetch details for {file_id}")
                stats["errors"] += 1
                continue
                
            output = detail_res.stdout.decode('utf-8', errors='replace')
            
            def get_val(pattern):
                m = re.search(pattern, output)
                return m.group(1).strip() if m else None

            from sync_recordings import parse_duration
            
            start_at_str = get_val(r'start_at:\s+(.*)')
            try:
                dt = datetime.fromisoformat(start_at_str.split('.')[0])
                timestamp = int(dt.timestamp())
            except:
                timestamp = 0
                
            cloud_has_trans = 1 if get_val(r'transcript:\s+(.*)') == "available" else 0
            cloud_has_sum = 1 if get_val(r'summary:\s+(.*)') == "available" else 0

            # 1. Register Initial Entry
            payload = {
                "id": file_id,
                "fullname": get_val(r'name:\s+(.*)'),
                "duration": parse_duration(get_val(r'duration:\s+(.*)')),
                "start_time": timestamp,
                "is_trash": 0,
                "downloaded": 0,
                "transcribed": 0,
                "analyzed": 0
            }
            db_manager.update_record(conn, payload)
            
            if not download_assets:
                print(f"  [OK] Metadata registered for {file_id} (Assets skipped)")
                continue

            update_payload = {"id": file_id}

            # Determine target filename
            target_filename = get_target_filename(file_id, payload['fullname'], payload['start_time'], ext="")
            audio_target = f"{target_filename}.mp3"
            md_target = f"{target_filename}.md"

            # 2. Download Audio
            local_audio, actual_size = download_audio(file_id, audio_target, audio_dir)
            if local_audio:
                update_payload.update({
                    "downloaded": 1,
                    "audio_path": local_audio,
                    "filesize": actual_size
                })
                stats["downloaded"] += 1

            # 3. Download Transcript directly to Obsidian
            if cloud_has_trans:
                local_trans = download_asset("transcript", file_id, md_target, obsidian_trans_dir)
                if local_trans:
                    update_payload.update({
                        "transcribed": 1,
                        "transcription_path": local_trans
                    })
                    stats["transcribed"] += 1

            # 4. Download Summary directly to Obsidian
            if cloud_has_sum:
                local_sum = download_asset("summary", file_id, md_target, obsidian_sum_dir)
                if local_sum:
                    update_payload.update({
                        "analyzed": 1,
                        "summary_path": local_sum
                    })
                    stats["analyzed"] += 1

            db_manager.update_record(conn, update_payload)
            print(f"  [OK] Assets synced for {file_id}")

        print(f"\nWorkflow Finished!")
        print(f"  New recordings registered: {stats['new']}")
        print(f"  Existing (skipped): {stats['existing']}")
        if download_assets:
            print(f"  Assets Downloaded: Audio({stats['downloaded']}), Trans({stats['transcribed']}), Sum({stats['analyzed']})")

    except Exception as e:
        print(f"Workflow Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Plaud Unified Sync & Download")
    parser.add_argument("--download", action="store_true", help="Download all available assets for new recordings")
    args = parser.parse_args()
    
    workflow_sync_and_download(download_assets=args.download)
