import os
import sqlite3
import sys
import re

# Add scripts directory to path to import db_manager
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(project_root, 'scripts'))
import db_manager

def sanitize_for_match(text):
    if not text: return ""
    # Remove extension, replace special chars and common separators with space, lowercase
    clean = re.sub(r'[^a-zA-Z0-9\s]+', ' ', text).lower()
    # Normalize multiple spaces
    clean = re.sub(r'\s+', ' ', clean)
    return clean.strip()

def scan_and_sync():
    db_path = os.path.join(project_root, 'data', 'plaud_records.db')
    audio_dir = os.path.join(project_root, 'data', 'audio')
    
    # Obsidian paths
    workspace_root = os.path.dirname(project_root)
    obsidian_trans_dir = os.path.join(workspace_root, 'Obsidian', 'plaud', 'transcription')
    obsidian_sum_dir = os.path.join(workspace_root, 'Obsidian', 'plaud', 'summary')

    conn = db_manager.init_db(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT id, fullname FROM recordings')
    records = cursor.fetchall()
    
    stats = {"audio": 0, "trans": 0, "sum": 0}

    # Pre-scan directories to avoid nested loops
    def get_files(d):
        return os.listdir(d) if os.path.exists(d) else []

    audio_files = get_files(audio_dir)
    trans_files = get_files(obsidian_trans_dir)
    sum_files = get_files(obsidian_sum_dir)

    for rec_id, fullname in records:
        update_data = {"id": rec_id}
        clean_fullname = sanitize_for_match(fullname)
        
        # 1. Check Audio
        for f in audio_files:
            clean_f = sanitize_for_match(f)
            if rec_id in f or (clean_fullname and (clean_fullname in clean_f or clean_f in clean_fullname)):
                update_data["downloaded"] = 1
                update_data["audio_path"] = os.path.abspath(os.path.join(audio_dir, f))
                stats["audio"] += 1
                break
        
        # 2. Check Transcription
        for f in trans_files:
            clean_f = sanitize_for_match(f)
            if rec_id in f or (clean_fullname and (clean_fullname in clean_f or clean_f in clean_fullname)):
                update_data["transcribed"] = 1
                update_data["transcription_path"] = os.path.abspath(os.path.join(obsidian_trans_dir, f))
                stats["trans"] += 1
                break

        # 3. Check Summary
        for f in sum_files:
            clean_f = sanitize_for_match(f)
            if rec_id in f or (clean_fullname and (clean_fullname in clean_f or clean_f in clean_fullname)):
                update_data["analyzed"] = 1
                update_data["summary_path"] = os.path.abspath(os.path.join(obsidian_sum_dir, f))
                stats["sum"] += 1
                break
        
        if len(update_data) > 1:
            db_manager.update_record(conn, update_data)

    conn.close()
    print(f"Sync complete!")
    print(f"  Audios linked: {stats['audio']}")
    print(f"  Transcriptions linked: {stats['trans']}")
    print(f"  Summaries linked: {stats['sum']}")

if __name__ == "__main__":
    scan_and_sync()
