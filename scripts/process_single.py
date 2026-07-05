import os
import sys
import subprocess
import sqlite3
import re
import time

# Add scripts directory to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(project_root, 'scripts'))
import db_manager
from workflow_download import download_audio, get_target_filename, run_plaud_command, rename_record_files, get_obsidian_path as _wf_get_obsidian_path

def get_obsidian_path():
    # Reutiliza a implementação do workflow_download para consistência
    return _wf_get_obsidian_path()


def sync_fullname_from_cloud(conn, record, env):
    """
    Consulta a API Plaud para obter o nome atual do arquivo.
    Se o nome for diferente do banco, renomeia os arquivos físicos e
    atualiza o banco. Retorna o record atualizado (com fullname correto).
    """
    file_id = record['id']
    old_name = record.get('fullname', '') or ''

    try:
        detail_res = None
        for attempt in range(3):
            detail_res = run_plaud_command(["file", file_id], env)
            if detail_res and "id:" in detail_res.stdout:
                break
            print(f"  [sync_name] Attempt {attempt+1} failed, retrying in 2s...")
            time.sleep(2.0)

        if not detail_res or "id:" not in detail_res.stdout:
            print(f"  [sync_name] Could not fetch cloud details for {file_id} — using stored name.")
            return record

        m = re.search(r'name:\s+(.*)', detail_res.stdout)
        cloud_name = m.group(1).strip() if m else None

        if cloud_name and cloud_name != old_name:
            print(f"  [sync_name] Name changed: '{old_name}' -> '{cloud_name}'")
            audio_dir = os.path.join(project_root, 'data', 'audio')
            obsidian_root = get_obsidian_path()
            obsidian_trans_dir = os.path.join(obsidian_root, 'transcription')
            obsidian_sum_dir = os.path.join(obsidian_root, 'summary')
            rename_record_files(conn, record, cloud_name, audio_dir, obsidian_trans_dir, obsidian_sum_dir)
            # Retorna o record atualizado para o caller usar o nome correto
            return db_manager.get_record(conn, file_id) or {**record, 'fullname': cloud_name}
    except Exception as e:
        print(f"  [sync_name] Warning: could not sync name from cloud: {e}")

    return record


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
        # Garantir que o nome no banco está atualizado antes de criar o arquivo
        record = sync_fullname_from_cloud(conn, record, env)

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
                "filesize_mb": round(actual_size / (1024 * 1024), 2),
                "status": "idle",
                "progress": 0
            })
            print(f"Success: Audio downloaded to {local_audio}")
        else:
            db_manager.update_record(conn, {"id": file_id, "status": "error", "progress": 0})
            print("Error: Failed to download audio.")
            sys.exit(1)

    elif action == "transcribe":
        # Garantir que o nome no banco está atualizado antes de criar o arquivo
        record = sync_fullname_from_cloud(conn, record, env)

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
        # Garantir que o nome no banco está atualizado antes de criar o arquivo
        record = sync_fullname_from_cloud(conn, record, env)

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
                
            import json
            gemini_prompt = """Você é um modelo de NLP especializado em analisar transcrições de áudio, gerar resumos executivos estruturados e extrair palavras-chave relevantes como tags para o Obsidian.

Com base na transcrição abaixo, gere o resumo do documento seguindo exatamente a estrutura abaixo:

1. **Tags de Indexação**: Na primeira linha do documento, escreva "Tags: " seguido de 3 a 6 tags relevantes para o conteúdo. As tags devem seguir a convenção do Obsidian: todas em letras minúsculas, sem acentos, sem caracteres especiais, utilizando hífen (-) como separador de palavras, e cada uma iniciada com o caractere '#'. Exemplo: Tags: #planejamento #sprint-review #banco-de-dados
2. **Título**: Um título em Markdown (usando '#' no início) representando o assunto principal.
3. **Resumo Executivo**: Uma seção iniciada por "## 🎯 Resumo Executivo" descrevendo brevemente os tópicos centrais.
4. **Principais Tópicos**: Uma seção iniciada por "## 🗺️ Tópicos Discutidos" contendo pontos detalhados em tópicos (bullet points).
5. **Ações/Decisões**: Uma seção iniciada por "## ✅ Action Items" com tarefas, decisões ou próximos passos identificados e seus responsáveis."""

            try:
                prompts_path = os.path.join(project_root, 'data', 'prompts.json')
                if os.path.exists(prompts_path):
                    with open(prompts_path, 'r', encoding='utf-8') as pf:
                        prompts_data = json.load(pf)
                        if 'geminiPrompt' in prompts_data and prompts_data['geminiPrompt'].strip():
                            gemini_prompt = prompts_data['geminiPrompt'].strip()
                            print(f"Usando prompt do Gemini personalizado do prompts.json")
            except Exception as pe:
                print(f"Aviso ao carregar prompts.json: {pe}")

            if "{transcript_text}" in gemini_prompt:
                prompt = gemini_prompt.replace("{transcript_text}", transcript_text)
            else:
                prompt = gemini_prompt + f"\n\nTranscrição:\n{transcript_text}"

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
