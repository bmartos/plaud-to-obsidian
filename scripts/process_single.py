import os
import sys
import subprocess
import sqlite3

# Add scripts directory to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(project_root, 'scripts'))
import db_manager
from workflow_download import download_audio, get_target_filename

def main():
    if len(sys.argv) < 3:
        print("Usage: python process_single.py <action> <file_id>")
        sys.exit(1)

    action = sys.argv[1]
    file_id = sys.argv[2]
    
    db_path = os.path.join(project_root, 'data', 'plaud_records.db')
    conn = db_manager.init_db(db_path)
    record = db_manager.get_record(conn, file_id)
    
    if not record:
        print(f"Error: Record {file_id} not found in database.")
        sys.exit(1)

    # Force UTF-8 for subprocess
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"

    if action == "download":
        audio_dir = os.path.join(project_root, 'data', 'audio')
        os.makedirs(audio_dir, exist_ok=True)
        
        target_filename = get_target_filename(file_id, record['fullname'], record['start_time'], ext=".mp3")
        local_audio, actual_size = download_audio(file_id, target_filename, audio_dir)
        
        if local_audio:
            db_manager.update_record(conn, {
                "id": file_id,
                "downloaded": 1,
                "audio_path": local_audio,
                "filesize": actual_size
            })
            print(f"Success: Audio downloaded to {local_audio}")
        else:
            print("Error: Failed to download audio.")
            sys.exit(1)

    elif action == "transcribe":
        if not record['audio_path'] or not os.path.exists(record['audio_path']):
            print("Error: Audio file must be downloaded first before local transcription.")
            sys.exit(1)
            
        trans_dir = os.path.join(os.path.dirname(project_root), 'Obsidian', 'plaud', 'transcription')
        os.makedirs(trans_dir, exist_ok=True)
        target_filename = get_target_filename(file_id, record['fullname'], record['start_time'], ext=".md")
        trans_path = os.path.join(trans_dir, target_filename)
        
        script_path = os.path.join(project_root, 'scripts', 'transcribe_local.py')
        
        print(f"Starting local transcription for {file_id}...")
        result = subprocess.run(["python", script_path, record['audio_path'], "medium", trans_path], env=env)
        
        if result.returncode == 0 and os.path.exists(trans_path):
            db_manager.update_record(conn, {
                "id": file_id,
                "transcribed": 1,
                "transcription_path": trans_path
            })
            print(f"Success: Transcription saved to {trans_path}")
        else:
            print("Error: Local transcription failed.")
            sys.exit(1)

    elif action == "summarize":
        print("Note: Local summarization with Gemini AI is not fully integrated yet.")
        print("This action will trigger the agentic workflow logic in the future.")
        # Placeholder for AI summarize logic
        # Once implemented, it should generate the summary, save to Obsidan/plaud/summary
        # and update DB: db_manager.update_record(conn, {"id": file_id, "analyzed": 1, "summary_path": ...})
        sys.exit(1)

    else:
        print(f"Error: Unknown action '{action}'")
        sys.exit(1)

    conn.close()

if __name__ == "__main__":
    main()
