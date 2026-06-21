import subprocess
import os
import sys
import re
import requests
import json
from datetime import datetime, timezone, timedelta
import time

# Forçar console a usar UTF-8 para evitar problemas de encoding em logs no Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add scripts directory to path to import db_manager
sys.path.append(os.path.join(os.path.dirname(__file__)))
import db_manager

def is_same_title(db_title, list_title):
    if not db_title:
        return False
    if not list_title:
        return False
        
    clean_list = list_title
    is_truncated = False
    
    for suffix in ['...', '…', '| ', '|']:
        if clean_list.endswith(suffix):
            clean_list = clean_list[:-len(suffix)].strip()
            is_truncated = True
            
    if is_truncated:
        # Se o título na lista está truncado, o local deve começar com o mesmo prefixo
        return db_title.startswith(clean_list)
    else:
        return db_title == list_title

def parse_duration(duration_str):
    """Parses duration like '16m33s' or '1h2m3s' into seconds."""
    if not duration_str:
        return 0
    if isinstance(duration_str, (int, float)):
        return int(duration_str)
    
    seconds = 0
    match = re.search(r'(\d+)h', duration_str)
    if match: seconds += int(match.group(1)) * 3600
    match = re.search(r'(\d+)m', duration_str)
    if match: seconds += int(match.group(1)) * 60
    match = re.search(r'(\d+)s', duration_str)
    if match: seconds += int(match.group(1))
    return seconds

# --- Helper functions (from original script, corrected where needed) ---
def sanitize_filename(name):
    clean = re.sub(r'[\/*?:"<>|]', "-", name)
    clean = clean.replace(" ", "_")
    return clean

def get_target_filename(file_id, fullname, start_time_val, ext=".md"):
    if start_time_val:
        if isinstance(start_time_val, (int, float)):
            dt = datetime.fromtimestamp(start_time_val, tz=timezone.utc)
            dt_brazil = dt - timedelta(hours=3) # Adjust for Brazil time zone
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

def run_plaud_command(args, env):
    # Envelopa TODOS os argumentos em aspas duplas de forma robusta no Windows CMD
    # para evitar que caracteres especiais como '&' sejam interpretados pelo terminal.
    cmd_args = []
    for arg in args:
        escaped = arg.replace('"', '\\"')
        cmd_args.append(f'"{escaped}"')
        
    cmd_str = "plaud " + " ".join(cmd_args)
    
    cmd_env = env.copy() if env else os.environ.copy()
    cmd_env["PLAUD_TELEMETRY_DISABLED"] = "1"
    
    # Filter out npm environment variables to avoid execution issues inside npm/Next.js script context
    keys_to_remove = [k for k in cmd_env.keys() if k.lower().startswith('npm_')]
    for k in keys_to_remove:
        del cmd_env[k]
    
    # Get the official plaud CLI path from environment or default to "plaud"
    plaud_bin = cmd_env.get("OFFICIAL_PLAUD_PATH", "plaud")
    cmd_str = f'"{plaud_bin}" ' + " ".join(cmd_args)
    
    # Generate a unique temp file path to avoid race conditions
    import uuid
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    temp_dir = os.path.join(project_root, 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    temp_file = os.path.join(temp_dir, f"plaud_cmd_{uuid.uuid4().hex}.txt")
    
    cmd_str_redirect = f"{cmd_str} > \"{temp_file}\" 2>&1"
    
    result = subprocess.run(
        cmd_str_redirect,
        stdin=subprocess.DEVNULL,
        check=False,
        shell=True,
        env=cmd_env
    )
    
    stdout_str = ""
    stderr_str = ""
    
    if os.path.exists(temp_file):
        try:
            with open(temp_file, 'r', encoding='utf-8', errors='replace') as f:
                stdout_str = f.read()
        except Exception as e:
            stderr_str = f"Error reading temp output file: {str(e)}"
            
        try:
            os.remove(temp_file)
        except:
            pass
            
    class CommandResult:
        def __init__(self, returncode, stdout, stderr):
            self.returncode = returncode
            self.stdout = stdout
            self.stderr = stderr
            
    return CommandResult(result.returncode, stdout_str, stderr_str)

def download_audio(file_id, target_filename, output_dir):
    """Downloads a single audio file and returns its local path and size."""
    try:
        print(f"  Fetching download URL for {file_id}...")
        
        # Force UTF-8 environment for subprocess
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PLAUD_TELEMETRY_DISABLED"] = "1"
        
        result = None
        url_match = None
        for attempt in range(3):
            result = run_plaud_command(["audio", file_id], env)
            output = result.stdout
            url_match = re.search(r'(https://plaud-bucket\.s3-accelerate\.amazonaws\.com/[^\s\n]+)', output)
            if url_match:
                break
            print(f"    [Warning] Fetch audio URL attempt {attempt+1} failed. Retrying in 2.0s...")
            time.sleep(2.0)
            
        if not url_match:
            print(f"    [Error] URL not found in output. Output was: {result.stdout if result else ''}")
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
        env["PLAUD_TELEMETRY_DISABLED"] = "1"

        result = None
        for attempt in range(3):
            # Se o arquivo foi gravado de uma tentativa anterior mal sucedida/corrompida, removemos
            if os.path.exists(filepath):
                try: os.remove(filepath)
                except: pass
                
            result = run_plaud_command([cmd_type, file_id, "-o", filepath], env)
            if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                break
            print(f"    [Warning] {cmd_type} download attempt {attempt+1} failed. Retrying in 2.0s...")
            time.sleep(2.0)

        if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
            return filepath
        else:
            print(f"    [Error] {cmd_type} download failed after 3 attempts. Stderr: {result.stderr if result else ''}")
            # Limpa qualquer arquivo parcial deixado
            if os.path.exists(filepath):
                try: os.remove(filepath)
                except: pass
            return None
    except Exception as e:
        print(f"    [Error] {cmd_type} exception: {e}")
        # Limpa qualquer arquivo parcial deixado
        if 'filepath' in locals() and os.path.exists(filepath):
            try: os.remove(filepath)
            except: pass
        return None

def workflow_sync_and_download(download_assets=False):
    """
    Core Workflow:
    1. Sync with Plaud Cloud.
    2. Identify recordings NOT in DB.
    3. Register them.
    4. IF download_assets is True: download ALL available assets (Audio, Transcript, and Summary).
    """
    if download_assets:
        print("Starting Workflow: Unified Sync & Download")
    else:
        print("Starting Workflow: Metadata Sync Only")
    
    # Setup Environment
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8" # Ensure consistent encoding for subprocess outputs
    env["PLAUD_TELEMETRY_DISABLED"] = "1"
    
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(project_root, 'data', 'plaud_records.db')
    
    # Paths for internal storage (local audio)
    audio_dir = os.path.join(project_root, 'data', 'audio')
    os.makedirs(audio_dir, exist_ok=True) # Ensure audio directory exists

    # Target paths for Obsidian (direct publish)
    obsidian_root = os.path.join(os.path.dirname(project_root), 'Obsidian', 'plaud')
    obsidian_trans_dir = os.path.join(obsidian_root, 'transcription')
    obsidian_sum_dir = os.path.join(obsidian_root, 'summary')
    os.makedirs(obsidian_trans_dir, exist_ok=True) # Ensure transcription directory exists
    os.makedirs(obsidian_sum_dir, exist_ok=True) # Ensure summary directory exists

    conn = db_manager.init_db(db_path)
    
    try:
        print("Fetching cloud files...")
        # --- (2) Call the synchronization command described in Plaud documentation ---
        # Based on previous tests, `plaud files -s 100` seems to be the way to list files
        
        print("Executing: plaud files -s 100")
        result = None
        for attempt in range(3):
            result = run_plaud_command(["files", "-s", "100"], env)
            if result.returncode == 0:
                break
            print(f"  [Warning] Attempt {attempt+1} for plaud files failed with code {result.returncode}. Retrying in 2.5s...")
            time.sleep(2.5)
            
        print(f"  plaud files returncode: {result.returncode}")
        if result.stderr:
            print(f"  plaud files stderr: {result.stderr}")
        
        # Check if output contains expected file listing structure before parsing
        if result.returncode != 0 and "Files on this page" not in result.stdout:
            print(f"Workflow Error: plaud files command failed with returncode {result.returncode} after 3 attempts.")
            raise Exception("Plaud CLI 'files' command failed to list files.")

        cloud_file_data = []
        # Parse output to get more than just IDs, to enable (3) linking to user ID if needed
        # and more robust checks for (4)
        
        # Example output structure from plaud files:
        # Files on this page: 73
        # ID                                  NAME                                  DATE          DURATION
        # ──────────────────────────────────────────────────────────────────────────────────────────────────
        # 9a3ba5a31039e18f92275626814bbd07    2026-06-18 16:09:32                   2026-06-18    1h57m
        
        # Regex to parse each line of file data
        file_line_pattern = re.compile(r'^\s*([a-f0-9]{32})\s+(.*?)\s+(\d{4}-\d{2}-\d{2})\s+(.*?)\s*$')
        
        # Split stdout into lines and parse matches
        lines = result.stdout.splitlines()
        for line in lines:
            match = file_line_pattern.match(line)
            if match:
                file_id, name, date_str, duration = match.groups()
                cloud_file_data.append({
                    "id": file_id.strip(),
                    "name": name.strip(),
                    "date": date_str.strip(),
                    "duration_str": duration.strip(),
                })

        print(f"Found {len(cloud_file_data)} files in cloud (parsed).")
        
        stats = {"new": 0, "existing": 0, "downloaded": 0, "transcribed": 0, "analyzed": 0, "errors": 0}

        # --- (4) Verify between Plaud system and plaud_records.db for un-downloaded files ---
        # --- (5) Catalog all missing files in the database and display on screen ---
        # The workflow will add new files to the DB, current status will be 'Não' for everything.

        for cloud_file in cloud_file_data:
            file_id = cloud_file["id"]
            record = db_manager.get_record(conn, file_id) # Check if record exists in our DB
            
            if record:
                stats["existing"] += 1
                fullname_db = record.get('fullname', '')
                cloud_name = cloud_file['name']
                # Sincroniza o título local apenas se ele diferir do da nuvem
                if not is_same_title(fullname_db, cloud_name):
                    # Se o nome retornado na listagem do cloud estiver truncado,
                    # buscamos o nome completo via 'plaud file <id>' antes de atualizar
                    clean_cloud = cloud_name
                    is_trunc = False
                    for suffix in ['...', '…', '| ', '|']:
                        if clean_cloud.endswith(suffix):
                            is_trunc = True
                            break
                    
                    real_name = cloud_name
                    if is_trunc:
                        print(f"  [+] Title changed on cloud and seems truncated. Fetching full title...")
                        detail_res = None
                        for attempt in range(3):
                            detail_res = run_plaud_command(["file", file_id], env)
                            if detail_res and "id:" in detail_res.stdout:
                                break
                            print(f"    [Warning] Fetch details attempt {attempt+1} failed. Retrying in 2.0s...")
                            time.sleep(2.0)
                            
                        if detail_res and "id:" in detail_res.stdout:
                            m = re.search(r'name:\s+(.*)', detail_res.stdout)
                            if m:
                                real_name = m.group(1).strip()
                    
                    print(f"[*] Updating title for {file_id}: '{fullname_db}' -> '{real_name}'")
                    db_manager.update_record(conn, {
                        "id": file_id,
                        "fullname": real_name
                    })
                continue 
            
            print(f"[*] Processing NEW file from cloud: {file_id} - {cloud_file['name']}")
            stats["new"] += 1
            
            # Fetch full details for the file
            detail_res = None
            for attempt in range(3):
                detail_res = run_plaud_command(["file", file_id], env)
                if detail_res and "id:" in detail_res.stdout:
                    break
                print(f"    [Warning] Fetch details attempt {attempt+1} failed for new file {file_id}. Retrying in 2.0s...")
                time.sleep(2.0)
                
            if not detail_res or "id:" not in detail_res.stdout:
                print(f"  [Error] Could not fetch details for {file_id} after 3 attempts. Returncode: {detail_res.returncode if detail_res else 'None'}, Stderr: {detail_res.stderr if detail_res else ''}")
                stats["errors"] += 1
                continue
                
            output = detail_res.stdout
            
            # Helper to extract values from the detailed file output
            def get_val(pattern):
                m = re.search(pattern, output)
                return m.group(1).strip() if m else None
            
            start_at_str = get_val(r'start_at:\s+(.*)')
            
            try:
                dt = datetime.fromisoformat(start_at_str.split('.')[0])
                timestamp = int(dt.timestamp())
            except (ValueError, TypeError): # Handle cases where start_at_str is None or invalid format
                timestamp = 0
                
            cloud_has_trans = 1 if get_val(r'transcript:\s+(.*)') == "available" else 0
            cloud_has_sum = 1 if get_val(r'summary:\s+(.*)') == "available" else 0

            # Register Initial Entry
            payload = {
                "id": file_id,
                "fullname": get_val(r'name:\s+(.*)') or cloud_file['name'], # Use full name from detail
                "duration": parse_duration(cloud_file['duration_str']), # Use duration from `plaud files` output
                "start_time": timestamp,
                "is_trash": 0,
                "downloaded": 0,
                "transcribed": 0,
                "analyzed": 0,
                "status": "idle", # Newly registered files are idle
                "progress": 0
            }
            db_manager.update_record(conn, payload)
            
            print(f"  [OK] Metadata registered for {file_id}")

        # --- (4) & (5) Check pending transcripts and summaries on Plaud Cloud and download if available ---
        print("\nChecking for missing transcripts/summaries in the local database...")
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, fullname, start_time, transcribed, analyzed 
            FROM recordings 
            WHERE transcribed = 0 
               OR analyzed = 0 
               OR fullname IS NULL 
               OR fullname = '' 
               OR fullname LIKE '%|' 
               OR fullname LIKE '%| ' 
               OR fullname LIKE '%…' 
               OR fullname LIKE '%...'
        """)
        pending_records = cursor.fetchall()
        
        print(f"Found {len(pending_records)} recording(s) with pending transcripts or summaries.")
        
        for record_item in pending_records:
            file_id, fullname, start_time, transcribed, analyzed = record_item
            
            is_title_truncated = (
                fullname.endswith('|') or 
                fullname.endswith('| ') or 
                fullname.endswith('…') or 
                fullname.endswith('...')
            )
            
            print(f"[*] Checking assets and title on cloud for: {fullname} ({file_id})")
            
            # Pequeno delay para evitar sobrecarga de processos Node/libuv no Windows
            time.sleep(0.8)
            
            detail_res = None
            for attempt in range(3):
                detail_res = run_plaud_command(["file", file_id], env)
                if detail_res and "id:" in detail_res.stdout:
                    break
                print(f"    [Warning] Fetch details attempt {attempt+1} failed for pending file {file_id}. Retrying in 2.0s...")
                time.sleep(2.0)
                
            if not detail_res or "id:" not in detail_res.stdout:
                print(f"  [Error] Failed to fetch details for {file_id} after 3 attempts. Stderr: {detail_res.stderr if detail_res else ''}")
                continue
                
            output = detail_res.stdout
            
            # Helper to extract values from the detailed file output
            def get_val_local(pattern):
                m = re.search(pattern, output)
                return m.group(1).strip() if m else None
                
            cloud_name = get_val_local(r'name:\s+(.*)')
            cloud_has_trans = 1 if get_val_local(r'transcript:\s+(.*)') == "available" else 0
            cloud_has_sum = 1 if get_val_local(r'summary:\s+(.*)') == "available" else 0
            
            updates = {}
            
            # If the title on cloud is complete and different from local, update it
            current_name = fullname
            if cloud_name and (is_title_truncated or fullname != cloud_name):
                print(f"  [+] Title updated to complete: '{fullname}' -> '{cloud_name}'")
                updates["fullname"] = cloud_name
                current_name = cloud_name
            
            # Check Transcript: If false locally, check if available on cloud to download
            if transcribed == 0:
                if cloud_has_trans == 1:
                    target_filename = get_target_filename(file_id, current_name, start_time, ext=".md")
                    print(f"  [+] Transcript is available on cloud. Downloading...")
                    filepath = download_asset("transcript", file_id, target_filename, obsidian_trans_dir)
                    if filepath:
                        updates["transcribed"] = 1
                        updates["transcription_path"] = filepath
                        stats["transcribed"] += 1
                        print(f"    [OK] Saved to {filepath}")
                else:
                    print("  [-] Transcript is not available on cloud yet.")
                    
            # Check Summary: If false locally, check if available on cloud to download
            if analyzed == 0:
                if cloud_has_sum == 1:
                    target_filename = get_target_filename(file_id, current_name, start_time, ext=".md")
                    print(f"  [+] Summary is available on cloud. Downloading...")
                    filepath = download_asset("summary", file_id, target_filename, obsidian_sum_dir)
                    if filepath:
                        updates["analyzed"] = 1
                        updates["summary_path"] = filepath
                        stats["analyzed"] += 1
                        print(f"    [OK] Saved to {filepath}")
                else:
                    print("  [-] Summary is not available on cloud yet.")
            
            # If assets were downloaded, update the SQLite database
            if updates:
                updates["id"] = file_id
                db_manager.update_record(conn, updates)

        print("\nWorkflow Finished!")
        print(f"  New recordings registered: {stats['new']}")
        print(f"  Existing (skipped): {stats['existing']}")
        print(f"  Assets Downloaded: Transcriptions({stats['transcribed']}), Summaries({stats['analyzed']})")

    except FileNotFoundError as e:
        print(f"Workflow Error: {e}")
    except Exception as e:
        print(f"Workflow Error: An unexpected error occurred: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Plaud Unified Sync & Download")
    parser.add_argument("--download", action="store_true", help="Download all available assets for new recordings")
    args = parser.parse_args()
    
    workflow_sync_and_download(download_assets=args.download)