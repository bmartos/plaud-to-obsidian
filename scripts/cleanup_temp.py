import os
import time
import shutil

def cleanup_temp_files(directory, days=7):
    """
    Deletes files in the specified directory that are older than the given number of days.
    """
    now = time.time()
    retention_seconds = days * 24 * 60 * 60
    
    if not os.path.exists(directory):
        return

    print(f"--- Iniciando limpeza de arquivos temporários (Retenção: {days} dias) ---")
    
    for filename in os.listdir(directory):
        file_path = os.path.join(directory, filename)
        
        # Check if it's a file
        if os.path.isfile(file_path):
            file_age = now - os.path.getmtime(file_path)
            
            if file_age > retention_seconds:
                try:
                    os.remove(file_path)
                    print(f"Deletado: {filename} (Idade: {file_age/(24*3600):.1f} dias)")
                except Exception as e:
                    print(f"Erro ao deletar {filename}: {e}")
    
    print("--- Limpeza concluída ---")

if __name__ == "__main__":
    # Path is relative to the project root
    temp_dir = os.path.join(os.path.dirname(__file__), "..", "temp")
    cleanup_temp_files(temp_dir)
