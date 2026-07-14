import sys
import os
import json
import urllib.request
import urllib.error
import mimetypes
import uuid
import time
import re

def format_timestamp(seconds):
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"[{minutes:02d}:{secs:02d}]"

def load_murmurai_config():
    # 1. Start with defaults
    config = {
        'MURMURAI_API_KEY': 'namastex888',
        'MURMURAI_PORT': '8880',
        'MURMURAI_HOST': 'localhost',
        'MURMURAI_HF_TOKEN': ''
    }
    
    # 2. Check environment variables
    for key in ['MURMURAI_API_KEY', 'MURMURAI_PORT', 'MURMURAI_HOST', 'MURMURAI_HF_TOKEN']:
        val = os.environ.get(key)
        if val:
            config[key] = val
            
    # 3. Read .env file from ~/.config/murmurai/.env
    env_path = os.path.expanduser("~/.config/murmurai/.env")
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        k = k.strip()
                        v = v.strip()
                        # Only override if not already set in environment
                        if k in config and not os.environ.get(k):
                            config[k] = v
        except Exception as e:
            print(f"Aviso: Erro ao ler .env do MurmurAI: {e}", file=sys.stderr)
            
    return config

def upload_file(url, file_path, api_key, initial_prompt=None, speaker_labels=True):
    boundary = uuid.uuid4().hex
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    }
    
    parts = []
    
    # Add file field
    filename = os.path.basename(file_path)
    mime_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
    parts.append(f'--{boundary}')
    parts.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"')
    parts.append(f'Content-Type: {mime_type}')
    parts.append(b'')
    with open(file_path, 'rb') as f:
        file_content = f.read()
    parts.append(file_content)
    
    # Add speaker_labels field
    parts.append(f'--{boundary}')
    parts.append('Content-Disposition: form-data; name="speaker_labels"')
    parts.append(b'')
    parts.append('true' if speaker_labels else 'false')
    
    # Add initial_prompt field if provided
    if initial_prompt:
        parts.append(f'--{boundary}')
        parts.append('Content-Disposition: form-data; name="initial_prompt"')
        parts.append(b'')
        parts.append(initial_prompt)
        
    parts.append(f'--{boundary}--')
    parts.append(b'')
    
    # Construct raw body
    body = bytearray()
    for part in parts:
        if isinstance(part, str):
            body.extend((part + '\r\n').encode('utf-8'))
        elif isinstance(part, bytes):
            body.extend(part + b'\r\n')
        else:
            body.extend(part)
            body.extend(b'\r\n')
            
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f"Erro na requisição da API (HTTP {e.code}): {error_body}", file=sys.stderr)
        raise e

def poll_transcript(url, transcript_id, api_key):
    headers = {
        'Authorization': f'Bearer {api_key}'
    }
    req = urllib.request.Request(f"{url}/{transcript_id}", headers=headers, method='GET')
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8'))

def transcribe(audio_path, model_size="medium", output_file=None):
    print(f"--- Iniciando processamento via MurmurAI ---", file=sys.stderr, flush=True)
    
    config = load_murmurai_config()
    api_key = config['MURMURAI_API_KEY']
    host = config['MURMURAI_HOST']
    port = config['MURMURAI_PORT']
    hf_token = config.get('MURMURAI_HF_TOKEN', '')
    
    speaker_labels = True
    if not hf_token or not hf_token.strip().startswith('hf_'):
        print("Aviso: Diarização de falantes desativada porque MURMURAI_HF_TOKEN não está configurada em ~/.config/murmurai/.env", file=sys.stderr, flush=True)
        speaker_labels = False
        
    if host == '0.0.0.0':
        host = '127.0.0.1'
        
    base_url = f"http://{host}:{port}/v1/transcript"
    
    # Load custom prompt from prompts.json if exists
    prompt = None
    try:
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        prompts_path = os.path.join(project_root, 'data', 'prompts.json')
        if os.path.exists(prompts_path):
            with open(prompts_path, 'r', encoding='utf-8') as pf:
                prompts_data = json.load(pf)
                if 'whisperPrompt' in prompts_data and prompts_data['whisperPrompt'].strip():
                    prompt = prompts_data['whisperPrompt'].strip()
                    print(f"Usando prompt personalizado do prompts.json", file=sys.stderr, flush=True)
    except Exception as pe:
        print(f"Aviso ao carregar prompts.json: {pe}", file=sys.stderr, flush=True)

    print(f"Enviando áudio para o servidor MurmurAI ({base_url})...", file=sys.stderr, flush=True)
    
    try:
        job = upload_file(base_url, audio_path, api_key, prompt, speaker_labels)
    except Exception as e:
        print(f"Erro ao conectar ou enviar para o MurmurAI. Certifique-se de que o servidor está rodando na porta {port}.", file=sys.stderr)
        raise e
        
    transcript_id = job.get('id')
    if not transcript_id:
        raise ValueError(f"Servidor não retornou ID de transcrição válido: {job}")
        
    print(f"Job enviado com sucesso (ID: {transcript_id}). Aguardando processamento...", file=sys.stderr, flush=True)
    
    last_reported_progress = 0
    while True:
        try:
            status_data = poll_transcript(base_url, transcript_id, api_key)
        except Exception as e:
            print(f"Erro ao consultar status da transcrição: {e}", file=sys.stderr)
            time.sleep(2)
            continue
            
        status = status_data.get('status')
        progress = status_data.get('progress', 0.0)
        
        # Report progress (MurmurAI progress is 0.0 to 1.0)
        percent = int(progress * 100)
        if percent >= last_reported_progress + 10 or status == 'completed':
            last_reported_progress = (percent // 10) * 10
            print(f"Progresso: {percent}%", file=sys.stderr, flush=True)
            
        if status == 'completed':
            break
        elif status == 'error':
            error_msg = status_data.get('error', 'Erro desconhecido no servidor.')
            raise RuntimeError(f"Erro no servidor durante a transcrição: {error_msg}")
            
        time.sleep(2)
        
    print("Transcrição concluída pelo MurmurAI. Formatando resultado...", file=sys.stderr, flush=True)
    
    utterances = status_data.get('utterances')
    
    formatted_output = []
    if utterances:
        last_speaker = None
        for utterance in utterances:
            # start is in milliseconds, convert to seconds
            start_secs = utterance['start'] / 1000.0
            timestamp = format_timestamp(start_secs)
            
            # Map speaker name to format expected by PlaudToObsidian (e.g. [Speaker 1])
            speaker = utterance.get('speaker') or 'SPEAKER_00'
            digits = re.findall(r'\d+', speaker)
            if digits:
                speaker_num = int(digits[0]) + 1
                speaker_label = f"[Speaker {speaker_num}]"
            else:
                speaker_label = f"[{speaker}]"
                
            if speaker_label != last_speaker:
                speaker_tag = f" {speaker_label}"
                last_speaker = speaker_label
            else:
                speaker_tag = ""
                
            text = utterance.get('text', '').strip()
            if text:
                formatted_output.append(f"{timestamp}{speaker_tag} {text}")
    else:
        # Fallback to plain text if utterances are missing
        text = status_data.get('text', '').strip()
        if text:
            formatted_output.append(text)
            
    result_text = "\n".join(formatted_output)
    
    if output_file:
        try:
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(result_text)
            print(f"Resultado salvo em: {output_file}", file=sys.stderr, flush=True)
        except Exception as e:
            print(f"Erro ao salvar arquivo: {e}", file=sys.stderr, flush=True)
            
    print(f"Processamento concluído com sucesso.", file=sys.stderr, flush=True)
    return result_text

if __name__ == "__main__":
    # Ensure UTF-8 output
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        
    if len(sys.argv) < 2:
        print("Usage: python transcribe_local.py <audio_path> [model_size] [output_path]")
        sys.exit(1)
        
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "medium"
    
    if len(sys.argv) > 3:
        output_path = sys.argv[3]
    else:
        base_name = os.path.basename(audio_path).split('.')[0]
        output_path = os.path.join(os.path.dirname(__file__), "..", "temp", f"transcription_{base_name}.txt")
        
    if not os.path.exists(audio_path):
        print(f"Error: File {audio_path} not found")
        sys.exit(1)
        
    try:
        transcribe(audio_path, model_size, output_path)
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
