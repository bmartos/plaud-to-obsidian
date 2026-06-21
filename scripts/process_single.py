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

def get_obsidian_path():
    # 1. Try env variable first (passed from Next.js server actions)
    obs_path = os.environ.get("OBSIDIAN_PLAUD_PATH")
    if obs_path and obs_path.strip():
        return obs_path.strip()

    # 2. Try loading from packages/web/.env
    try:
        env_path = os.path.join(project_root, 'packages', 'web', '.env')
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if '=' in line and not line.strip().startswith('#'):
                        k, v = line.split('=', 1)
                        if k.strip() == 'OBSIDIAN_PLAUD_PATH' and v.strip():
                            return v.strip().strip('"').strip("'")
    except Exception as e:
        print(f"[Warning] Failed to load path from .env: {e}", file=sys.stderr)

    # 3. Fallback to default
    return os.path.join(os.path.dirname(project_root), 'Obsidian', 'plaud')

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
            
        trans_dir = os.path.join(get_obsidian_path(), 'transcription')
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
Você é um modelo de NLP especializado em analisar transcrições de áudio, gerar resumos executivos estruturados e extrair palavras-chave relevantes como tags para o Obsidian.

Com base na transcrição abaixo, gere o resumo do documento seguindo exatamente a estrutura abaixo:

1. **Tags de Indexação**: Na primeira linha do documento, escreva "Tags: " seguido de 3 a 6 tags relevantes para o conteúdo. As tags devem seguir a convenção do Obsidian: todas em letras minúsculas, sem acentos, sem caracteres especiais, utilizando hífen (-) como separador de palavras, e cada uma iniciada com o caractere '#'. Exemplo: Tags: #planejamento #sprint-review #banco-de-dados
2. **Título**: Um título em Markdown (usando '#' no início) representando o assunto principal.
3. **Resumo Executivo**: Uma seção iniciada por "## 🎯 Resumo Executivo" descrevendo brevemente os tópicos centrais.
4. **Principais Tópicos**: Uma seção iniciada por "## 🗺️ Tópicos Discutidos" contendo pontos detalhados em tópicos (bullet points).
5. **Ações/Decisões**: Uma seção iniciada por "## ✅ Action Items" com tarefas, decisões ou próximos passos identificados e seus responsáveis.

Transcrição:
{transcript_text}
"""
            # Using gemini-3.5-flash as it is available in this environment
            response = client.models.generate_content(
                model='gemini-3.5-flash', 
                contents=prompt,
            )
            
            summary_text = response.text
            
            sum_dir = os.path.join(get_obsidian_path(), 'summary')
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
