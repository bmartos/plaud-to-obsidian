import os
import sys
import re
import sqlite3

# Add scripts directory to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(project_root, 'data', 'plaud_records.db')
obsidian_root = os.path.join(os.path.dirname(project_root), 'Obsidian', 'plaud')
trans_dir = os.path.join(obsidian_root, 'transcription')
sum_dir = os.path.join(obsidian_root, 'summary')

def sanitize_filename(name):
    # Replace invalid Windows filename characters and spaces
    clean = re.sub(r'[\\/*?:"<>|]', "-", name)
    clean = clean.replace(" ", "_")
    return clean

def get_target_filename(record):
    date_str = record['start_time'].split(' ')[0] # YYYY-MM-DD
    safe_name = sanitize_filename(record['fullname'])
    return f"{date_str}_{safe_name}.md"

def match_and_rename(directory, record):
    if not os.path.exists(directory):
        return None
        
    target_name = get_target_filename(record)
    target_path = os.path.join(directory, target_name)
    
    # 1. If the exact target already exists, we're good
    if os.path.exists(target_path):
        return target_path
        
    date_str = record['start_time'].split(' ')[0]
    id_full = record['id']
    id_short = id_full[:8]
    safe_name = sanitize_filename(record['fullname'])
    
    files = os.listdir(directory)
    matched_file = None
    
    for f in files:
        if not f.endswith('.md'): continue
        
        # Match by exact ID
        if f == f"{id_full}.md":
            matched_file = f
            break
        # Match by ID short suffix
        if id_short in f:
            matched_file = f
            break
        # Match by date and similar name
        if f.startswith(date_str) and (safe_name in f or f.replace('.md', '').endswith(safe_name)):
            matched_file = f
            break
            
    if matched_file:
        old_path = os.path.join(directory, matched_file)
        print(f"Renaming: {matched_file} -> {target_name}")
        try:
            os.rename(old_path, target_path)
            return target_path
        except Exception as e:
            print(f"Error renaming {old_path}: {e}")
            return old_path # return old path if rename fails
            
    return None

def main():
    if not os.path.exists(db_path):
        print("Database not found.")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM recordings")
    records = cursor.fetchall()
    
    updated_count = 0
    for row in records:
        record = dict(row)
        
        trans_path = match_and_rename(trans_dir, record)
        sum_path = match_and_rename(sum_dir, record)
        
        has_trans = 1 if trans_path else 0
        has_sum = 1 if sum_path else 0
        
        cursor.execute('''UPDATE recordings 
                          SET transcribed = ?, transcription_path = ?,
                              analyzed = ?, summary_path = ?
                          WHERE id = ?''', 
                       (has_trans, trans_path, has_sum, sum_path, record['id']))
        updated_count += 1
                              
    conn.commit()
    conn.close()
    print(f"Asset synchronization complete. {updated_count} records checked.")

if __name__ == "__main__":
    main()
