import sys
from faster_whisper import WhisperModel
import os

def transcribe(audio_path):
    model_size = os.environ.get("WHISPER_MODEL_SIZE", "small")
    language = os.environ.get("WHISPER_LANGUAGE", "pt")
    device = os.environ.get("WHISPER_DEVICE", "cpu")
    
    model = WhisperModel(model_size, device=device, compute_type="int8")
    segments, info = model.transcribe(audio_path, beam_size=5, language=language)

    full_text = ""
    for segment in segments:
        full_text += segment.text + " "

    return full_text.strip()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe_local.py <audio_path>", file=sys.stderr)
        sys.exit(1)
    
    path = sys.argv[1]
    if not os.path.exists(path):
        print(f"Error: File not found: {path}", file=sys.stderr)
        sys.exit(1)
        
    try:
        result = transcribe(path)
        print(result)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
