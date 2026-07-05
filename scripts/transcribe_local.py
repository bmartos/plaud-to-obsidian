import sys
import os
import json
import warnings
import torch
import numpy as np
from sklearn.cluster import AgglomerativeClustering
import torchaudio
import time

# Suppress potential warnings from libraries
warnings.filterwarnings("ignore")

try:
    from faster_whisper import WhisperModel
except ImportError:
    print("Error: faster-whisper not installed. Run 'pip install faster-whisper'")
    sys.exit(1)

try:
    from speechbrain.inference.speaker import EncoderClassifier
except ImportError:
    print("Error: speechbrain not installed. Run 'pip install speechbrain'")
    sys.exit(1)

def format_timestamp(seconds):
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"[{minutes:02d}:{secs:02d}]"

def get_speaker_embeddings(waveform, sample_rate, segments, classifier):
    """
    Extracts speaker embeddings for each segment using SpeechBrain.
    Only segments with minimum duration are used for embeddings.
    """
    embeddings = []
    segment_indices = [] # Indices of segments that got an embedding
    
    # We need a longer duration for a more stable embedding on CPU/Noisy audio
    min_samples = int(2.5 * sample_rate)
    
    for i, segment in enumerate(segments):
        start_sample = int(segment.start * sample_rate)
        end_sample = int(segment.end * sample_rate)
        
        if start_sample >= waveform.shape[1]:
            continue
        end_sample = min(end_sample, waveform.shape[1])
        
        # Only use segments that are long enough for a good voice print
        if end_sample - start_sample < min_samples:
            continue
            
        segment_waveform = waveform[:, start_sample:end_sample]
        
        with torch.no_grad():
            embedding = classifier.encode_batch(segment_waveform)
            embeddings.append(embedding.squeeze().cpu().numpy())
            segment_indices.append(i)
            
    return np.array(embeddings), segment_indices

def load_audio_av(audio_path, target_sample_rate=16000):
    """
    Loads audio using PyAV (av library) which is more robust for MP3s on Windows.
    """
    import av
    container = av.open(audio_path)
    resampler = av.AudioResampler(
        format='s16',
        layout='mono',
        rate=target_sample_rate,
    )
    
    frames = []
    for frame in container.decode(audio=0):
        resampled_frames = resampler.resample(frame)
        for rf in resampled_frames:
            frames.append(rf.to_ndarray())
            
    if not frames:
        return None, target_sample_rate
        
    waveform = np.concatenate(frames, axis=1)
    # Convert to float32 and normalize
    waveform = waveform.astype(np.float32) / 32768.0
    # Convert to torch tensor
    return torch.from_numpy(waveform), target_sample_rate

def run_cleanup():
    """
    Runs the cleanup script to remove old temporary files.
    """
    try:
        from cleanup_temp import cleanup_temp_files
        temp_dir = os.path.join(os.path.dirname(__file__), "..", "temp")
        cleanup_temp_files(temp_dir)
    except Exception as e:
        print(f"Erro ao executar limpeza: {e}", file=sys.stderr)

def transcribe(audio_path, model_size="small", output_file=None):
    """
    Transcribes audio with optimized parameters and performs speaker diarization.
    """
    print(f"--- Iniciando processamento local ({model_size}) ---", file=sys.stderr, flush=True)
    
    # Run cleanup before starting new process
    run_cleanup()

    # 1. Initialize Whisper Model
    print(f"Carregando modelo Whisper {model_size}...", file=sys.stderr, flush=True)
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    
    prompt = (
        "Transcrição de reunião técnica e conversa casual em português do Brasil (pt-BR). "
        "Inclui termos sobre investimentos, ações do Google, saúde, diabetes (Glifage, Ozempic, insulina), "
        "esportes como triatlo e mergulho, e localizações como Santos, Ilhabela e Sorocaba. "
        "Mantenha a pontuação natural e evite repetições de gagueira."
    )
    try:
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        prompts_path = os.path.join(project_root, 'data', 'prompts.json')
        if os.path.exists(prompts_path):
            with open(prompts_path, 'r', encoding='utf-8') as pf:
                prompts_data = json.load(pf)
                if 'whisperPrompt' in prompts_data and prompts_data['whisperPrompt'].strip():
                    prompt = prompts_data['whisperPrompt'].strip()
                    print(f"Usando prompt do Whisper personalizado do prompts.json", file=sys.stderr, flush=True)
    except Exception as pe:
        print(f"Aviso ao carregar prompts.json: {pe}", file=sys.stderr, flush=True)


    # 2. Perform Transcription
    print(f"Transcrevendo áudio...", file=sys.stderr, flush=True)
    segments_gen, info = model.transcribe(
        audio_path,
        language="pt",
        initial_prompt=prompt,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
        condition_on_previous_text=True,
        word_timestamps=False
    )
    
    total_duration = info.duration
    last_reported_progress = 0
    all_segments = []
    
    print(f"Duração total: {total_duration:.2f}s", file=sys.stderr, flush=True)

    for segment in segments_gen:
        all_segments.append(segment)
        progress = (segment.end / total_duration) * 100
        if progress >= last_reported_progress + 10:
            last_reported_progress = (int(progress) // 10) * 10
            print(f"Progresso: {last_reported_progress}%", file=sys.stderr, flush=True)
    
    print(f"Fim da transcrição: {len(all_segments)} segmentos encontrados.", file=sys.stderr, flush=True)
    
    if not all_segments:
        return "Nenhuma fala detectada."

    # 3. Speaker Diarization
    print(f"Carregando modelo de reconhecimento de voz (SpeechBrain)...", file=sys.stderr, flush=True)
    # Load speaker recognition model
    classifier = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb", run_opts={"device":"cpu"})
    
    # Load audio for embedding extraction
    print(f"Carregando áudio para análise de timbre...", file=sys.stderr, flush=True)
    try:
        waveform, sample_rate = load_audio_av(audio_path)
    except Exception as e:
        print(f"Warning: Could not load audio with av: {e}. Trying torchaudio fallback...", file=sys.stderr, flush=True)
        waveform, sample_rate = torchaudio.load(audio_path)
        # SpeechBrain model expects 16kHz
        if sample_rate != 16000:
            resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
            waveform = resampler(waveform)
            sample_rate = 16000
        # Convert to mono if stereo
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
    
    if waveform is None:
        return "Erro ao carregar áudio para diarização."
        
    print(f"Extraindo características de voz (embeddings)...", file=sys.stderr, flush=True)
    embeddings, valid_indices = get_speaker_embeddings(waveform, sample_rate, all_segments, classifier)
    print(f"Embeddings extraídos: {len(embeddings)} de {len(all_segments)} segmentos.", file=sys.stderr, flush=True)
    
    # Initialize labels with None
    all_labels = [None] * len(all_segments)
    
    if len(embeddings) > 0:
        print(f"Agrupando falantes por similaridade...", file=sys.stderr, flush=True)
        # Normalize embeddings
        embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
        
        # Cluster embeddings
        clustering = AgglomerativeClustering(
            n_clusters=None, 
            distance_threshold=0.7, 
            metric='cosine', 
            linkage='average'
        )
        
        if len(embeddings) > 1:
            cluster_ids = clustering.fit_predict(embeddings)
        else:
            cluster_ids = [0]
            
        # Assign cluster IDs to their corresponding segments
        for idx, cid in zip(valid_indices, cluster_ids):
            all_labels[idx] = cid
            
        # Fill in missing labels
        last_cid = None
        for i in range(len(all_labels)):
            if all_labels[i] is None:
                all_labels[i] = last_cid
            else:
                last_cid = all_labels[i]
        
        last_cid = None
        for i in range(len(all_labels) - 1, -1, -1):
            if all_labels[i] is None:
                all_labels[i] = last_cid
            else:
                last_cid = all_labels[i]
        
        all_labels = [cid if cid is not None else 0 for cid in all_labels]
            
        # Map cluster IDs
        id_map = {}
        next_speaker_num = 1
        speaker_tags = []
        for cid in all_labels:
            if cid not in id_map:
                id_map[cid] = next_speaker_num
                next_speaker_num += 1
            speaker_tags.append(f"[Speaker {id_map[cid]}]")
            
        num_speakers = next_speaker_num - 1
        print(f"Diarização concluída: {num_speakers} falantes detectados.", file=sys.stderr, flush=True)
    else:
        speaker_tags = [""] * len(all_segments)

    # 4. Format Result
    formatted_output = []
    last_speaker = None
    
    for segment, label in zip(all_segments, speaker_tags):
        if len(segment.text.strip()) > 1:
            timestamp = format_timestamp(segment.start)
            
            if label != last_speaker:
                speaker_tag = f" {label}" if label else ""
                last_speaker = label
            else:
                speaker_tag = ""
                
            formatted_output.append(f"{timestamp}{speaker_tag} {segment.text.strip()}")
        
    result_text = "\n".join(formatted_output)
    
    # Handle File Saving directly to ensure UTF-8 and Location
    if output_file:
        try:
            # Ensure the directory exists
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(result_text)
            print(f"Resultado salvo em: {output_file}", file=sys.stderr, flush=True)
        except Exception as e:
            print(f"Erro ao salvar arquivo: {e}", file=sys.stderr, flush=True)

    print(f"Processamento concluído com sucesso.", file=sys.stderr, flush=True)
    return result_text

if __name__ == "__main__":
    # Ensure UTF-8 output for Portuguese characters
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    if len(sys.argv) < 2:
        print("Usage: python transcribe_local.py <audio_path> [model_size] [output_path]")
        sys.exit(1)
        
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "medium"
    # Logic for default output path in PlaudToObsidian/temp
    if len(sys.argv) > 3:
        output_path = sys.argv[3]
    else:
        # Generate default name based on audio filename
        base_name = os.path.basename(audio_path).split('.')[0]
        output_path = os.path.join(os.path.dirname(__file__), "..", "temp", f"transcription_{base_name}.txt")
    
    if not os.path.exists(audio_path):
        print(f"Error: File {audio_path} not found")
        sys.exit(1)
        
    try:
        result = transcribe(audio_path, model_size, output_path)
        # Also print to stdout for backward compatibility if needed, but primary is file
        # print(result) 
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(f"Error during transcription: {str(e)}", file=sys.stderr)
        sys.exit(1)
