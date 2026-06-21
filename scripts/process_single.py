import os
import sys
import subprocess
import sqlite3
import re

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
        
        db_manager.update_record(conn, {"id": file_id, "status": "downloading", "progress": 50})
        target_filename = get_target_filename(file_id, record['fullname'], record['start_time'], ext=".mp3")
        local_audio, actual_size = download_audio(file_id, target_filename, audio_dir)
        
        if local_audio:
            db_manager.update_record(conn, {
                "id": file_id,
                "downloaded": 1,
                "audio_path": local_audio,
                "filesize": actual_size,
                "status": "idle",
                "progress": 0
            })
            print(f"Success: Audio downloaded to {local_audio}")
        else:
            db_manager.update_record(conn, {"id": file_id, "status": "error", "progress": 0})
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
        
        db_manager.update_record(conn, {"id": file_id, "status": "transcribing", "progress": 0})
        print(f"Starting local transcription for {file_id}...")
        
        p = subprocess.Popen(["python", "-u", script_path, record['audio_path'], "medium", trans_path], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
        
        for line in p.stdout:
            print(line, end="", flush=True)
            if "Progresso:" in line:
                try:
                    pct = int(re.search(r'Progresso:\s*(\d+)%', line).group(1))
                    db_manager.update_record(conn, {"id": file_id, "progress": pct})
                except Exception as e:
                    pass
                    
        p.wait()
        
        if p.returncode == 0 and os.path.exists(trans_path):
            db_manager.update_record(conn, {
                "id": file_id,
                "transcribed": 1,
                "transcription_path": trans_path,
                "status": "idle",
                "progress": 0
            })
            print(f"Success: Transcription saved to {trans_path}")
        else:
            db_manager.update_record(conn, {"id": file_id, "status": "error", "progress": 0})
            print("Error: Local transcription failed.")
            sys.exit(1)

    elif action == "summarize":
        if not record['transcription_path'] or not os.path.exists(record['transcription_path']):
            print("Error: Transcription must exist before summarizing.")
            sys.exit(1)
            
        db_manager.update_record(conn, {"id": file_id, "status": "summarizing", "progress": 50})
        print(f"Starting AI summarization for {file_id}...")
        
        try:
            from google import genai
            from google.genai import types
            from dotenv import load_dotenv
            
            # Load .env from root to get GEMINI_API_KEY
            load_dotenv(os.path.join(project_root, '.env'))
            
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                print("Error: GEMINI_API_KEY environment variable is not set in .env file.")
                db_manager.update_record(conn, {"id": file_id, "status": "error", "progress": 0})
                sys.exit(1)
                
            client = genai.Client(api_key=api_key)
            
            with open(record['transcription_path'], 'r', encoding='utf-8') as f:
                transcript_text = f.read()
                
            prompt = f"""
Você é um assistente especializado em organizar atas e anotações. 
Baseado na transcrição abaixo, crie um resumo estruturado contendo:
1. Título do assunto principal.
2. Principais tópicos discutidos (em bullet points).
3. Decisões tomadas ou próximos passos (Action Items).

Transcrição:
{transcript_text}
"""
            # Using gemini-3.5-flash as it is available in this environment
            response = client.models.generate_content(
                model='gemini-3.5-flash', 
                contents=prompt,
            )
            
            summary_text = response.text
            
            sum_dir = os.path.join(os.path.dirname(project_root), 'Obsidian', 'plaud', 'summary')
            os.makedirs(sum_dir, exist_ok=True)
            
            target_filename = get_target_filename(file_id, record['fullname'], record['start_time'], ext=".md")
            sum_path = os.path.join(sum_dir, target_filename)
            
            with open(sum_path, "w", encoding="utf-8") as f:
                f.write(summary_text)
                
            db_manager.update_record(conn, {
                "id": file_id,
                "analyzed": 1,
                "summary_path": sum_path,
                "status": "idle",
                "progress": 0
            })
            print(f"Success: Summary saved to {sum_path}")
            
        except ImportError:
            print("Error: google-genai or python-dotenv package not installed. Run 'pip install google-genai python-dotenv'")
            db_manager.update_record(conn, {"id": file_id, "status": "error", "progress": 0})
            sys.exit(1)
        except Exception as e:
            print(f"Error during summarization: {e}")
            db_manager.update_record(conn, {"id": file_id, "status": "error", "progress": 0})
            sys.exit(1)

    else:
        print(f"Error: Unknown action '{action}'")
        sys.exit(1)

    conn.close()

if __name__ == "__main__":
    main()
