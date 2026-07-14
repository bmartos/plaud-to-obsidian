import os
import sys
import sqlite3
import subprocess
import time
import re

# Forçar console a usar UTF-8 no Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(project_root, 'data', 'plaud_records.db')

def parse_duration_to_seconds(dur_str):
    if not dur_str:
        return 0
    # hh:mm:ss format
    parts = dur_str.split(':')
    if len(parts) == 3:
        try:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        except ValueError:
            return 0
    return 0

def run_command(args):
    print(f"Executing: {' '.join(args)}", flush=True)
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    p = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
    for line in p.stdout:
        print(line, end="", flush=True)
    p.wait()
    return p.returncode

def main():
    # 1. Sync metadata and download already available cloud transcripts/summaries
    print("=== Step 1: Syncing metadata and downloading available cloud assets ===", flush=True)
    sync_code = run_command(["python", "-u", "scripts/workflow_download.py", "--download"])
    if sync_code != 0:
        print("Warning: Syncing metadata failed. Continuing with existing database records.", flush=True)

    # 2. Get pending recordings (still not transcribed)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT id, fullname, duration, downloaded, transcribed, audio_path FROM recordings WHERE transcribed = 0").fetchall()
    conn.close()

    recordings = []
    for r in rows:
        d = dict(r)
        d['duration_secs'] = parse_duration_to_seconds(d['duration'])
        recordings.append(d)

    # Sort from smallest to largest duration
    recordings.sort(key=lambda x: x['duration_secs'])

    print(f"\n=== Found {len(recordings)} recordings pending transcription ===", flush=True)
    for r in recordings:
        print(f" - {r['fullname']} ({r['duration']}) [ID: {r['id']}]", flush=True)

    # Process sequentially
    for i, r in enumerate(recordings):
        file_id = r['id']
        name = r['fullname'] or f"Recording {file_id}"
        dur = r['duration']
        print(f"\n==========================================", flush=True)
        print(f"Processing [{i+1}/{len(recordings)}]: {name} ({dur})", flush=True)
        print(f"==========================================", flush=True)

        # Check if audio file exists locally
        audio_path = r['audio_path']
        need_download = True
        if r['downloaded'] == 1 and audio_path and os.path.exists(audio_path):
            need_download = False
            print(f"Audio already downloaded: {audio_path}", flush=True)

        if need_download:
            print("Downloading audio...", flush=True)
            dl_code = run_command(["python", "-u", "scripts/process_single.py", "download", file_id])
            if dl_code != 0:
                print(f"Error: Failed to download audio for {name}. Skipping to next file.", flush=True)
                continue
        
        # Start transcription
        print("Starting transcription...", flush=True)
        trans_code = run_command(["python", "-u", "scripts/process_single.py", "transcribe", file_id])
        if trans_code != 0:
            print(f"Error: Failed to transcribe {name}.", flush=True)
        else:
            print(f"Success: Completed transcription for {name}.", flush=True)

        time.sleep(2)

    print("\n=== All pending transcriptions processed! ===", flush=True)

if __name__ == '__main__':
    main()
