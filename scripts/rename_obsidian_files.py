import os
import sqlite3
import sys
import re
from datetime import datetime

# Add scripts directory to path to import db_manager
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(project_root, 'scripts'))
import db_manager
from workflow_download import sanitize_filename, get_target_filename

def sanitize_for_match(text):
    if not text: return ""
    # Remove extension
    name = os.path.splitext(text)[0]
    # Replace special chars and common separators with space, lowercase
    clean = re.sub(r'[^a-zA-Z0-9\s]+', ' ', name).lower()
    # Normalize multiple spaces
    clean = re.sub(r'\s+', ' ', clean)
    return clean.strip()

def rename_obsidian_files():
    db_path = os.path.join(project_root, 'data', 'plaud_records.db')
    workspace_root = os.path.dirname(project_root)
    
    dirs_to_process = [
        os.path.join(workspace_root, 'Obsidian', 'plaud', 'transcription'),
        os.path.join(workspace_root, 'Obsidian', 'plaud', 'summary')
    ]

    conn = db_manager.init_db(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT id, fullname, start_time FROM recordings')
    records = cursor.fetchall()
    
    # Map records by sanitized name and ID for quick lookup
    name_to_record = {}
    id_to_record = {}
    for rec_id, fullname, start_time in records:
        clean_name = sanitize_for_match(fullname)
        if clean_name:
            name_to_record[clean_name] = (rec_id, fullname, start_time)
        id_to_record[rec_id] = (rec_id, fullname, start_time)

    rename_stats = 0
    db_update_stats = 0

    for target_dir in dirs_to_process:
        if not os.path.exists(target_dir):
            continue
            
        print(f"Processing directory: {target_dir}")
        for filename in os.listdir(target_dir):
            if not filename.endswith(('.md', '.txt')):
                continue
                
            old_path = os.path.join(target_dir, filename)
            clean_filename = sanitize_for_match(filename)
            
            # Find matching record
            match = None
            # Try ID match first
            for rec_id in id_to_record:
                if rec_id in filename:
                    match = id_to_record[rec_id]
                    break
            
            # Try name match
            if not match:
                if clean_filename in name_to_record:
                    match = name_to_record[clean_filename]
                else:
                    # Partial match attempt
                    for clean_rec_name in name_to_record:
                        if clean_rec_name in clean_filename or clean_filename in clean_rec_name:
                            match = name_to_record[clean_rec_name]
                            break
            
            if match:
                rec_id, fullname, start_time = match
                # Correct format: YYYY-MM-DD_filename.md
                new_filename = get_target_filename(rec_id, fullname, start_time, ext=".md")
                new_path = os.path.join(target_dir, new_filename)
                
                if old_path != new_path:
                    print(f"  Renaming: {filename} -> {new_filename}")
                    try:
                        # If target exists, merge/overwrite or skip? Overwriting for consistency.
                        if os.path.exists(new_path) and old_path != new_path:
                            os.remove(old_path)
                            print(f"    [Merge] File {new_filename} already existed. Kept existing, removed old.")
                        else:
                            os.rename(old_path, new_path)
                        rename_stats += 1
                        
                        # Update DB path
                        field = "transcription_path" if "transcription" in target_dir else "summary_path"
                        db_manager.update_record(conn, {"id": rec_id, field: os.path.abspath(new_path)})
                        db_update_stats += 1
                    except Exception as e:
                        print(f"    [Error] Failed to rename {filename}: {e}")
            else:
                print(f"  [Skip] No database match for: {filename}")

    conn.close()
    print(f"\nTask Finished!")
    print(f"  Files renamed/standardized: {rename_stats}")
    print(f"  Database paths updated: {db_update_stats}")

if __name__ == "__main__":
    rename_obsidian_files()
