import subprocess
import re
import os
import requests

ids = [
    "1ac9894c3d3dc591d1e5cd1fdd1bd1dd", "bb561b11e3faaba65c485533f4a0d973", "e3a261e677ca75fd43850b482edd4fef",
    "49f44c912d0d9a2fa414a0e8fb38c810", "dc18f264cfb9612b0f540d7c1d307e14", "4231d9b7eaa213af29c9594242061cf1",
    "6bba1da7f762ac245b84b08d5603b978", "c5e1c183e7169074d7d0f4f398aa9d45", "3f4273c0baccebda5702e6760a30a5c6",
    "f2653dac337498052590ffc43b8c9e2c", "55b9120d2ed3d3fc369d1ad4fca1dec0", "272f4fb68c472346c9c3a945763efacc",
    "2d206af1da48df8032b7866533ae91e5", "ced23851e09ec73c3e4096f03c5cf040", "5d6a97f230aa2bfdf7fd55f182b97932",
    "8a10be14614bbbfb9592104f4dfc2e31", "a0a98e10fe2a9328d1374bfa9cbaf1ea", "41acc718f5bc29781292eb6ee570168f",
    "9681d700eadfab5fe67c1356313438d7", "7ee3819c257102f74fb4cce9a6eab378", "994466fdc112bda4aa028e14ac1ae341",
    "b2993787c87b602adaeebb77a7d5a76a", "cd82810585a55e92b663e70b6e978a1b", "66857a16fbd71c95ad4f8702f6587b84",
    "4d5d31f050908e4f2df4e6096a777d52", "aa50292ea2b9a6c179368b328394acc5", "b2db4cc18ddf32e7d5e8b70a275c0bf2",
    "b4ff07ff008888374ffb8138a57e30c9", "efd1f8f62d207a38f521942b09ee6448", "823131c802f081e0e41a196323eaf139"
]

output_dir = "PlaudToObsidian/data/audio"
os.makedirs(output_dir, exist_ok=True)

for file_id in ids:
    print(f"Processing {file_id}...")
    try:
        # Run official CLI to get URL
        result = subprocess.run(["plaud", "audio", file_id], capture_output=True, text=True, check=True, shell=True)
        output = result.stdout
        
        # Extract URL
        match = re.search(r'(https?://[^\s\n]+)', output)
        if not match:
            print(f"  [Error] Could not find URL in output for {file_id}")
            print(f"  [DEBUG] Output was: {output}")
            continue
            
        url = match.group(1)
        print(f"  Found URL, downloading...")
        
        # Download file
        filepath = os.path.join(output_dir, f"{file_id}.mp3")
        if os.path.exists(filepath):
            print(f"  [Skip] Already exists")
            continue
            
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        with open(filepath, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"  [Success] Saved to {filepath}")
        
    except Exception as e:
        print(f"  [Error] Failed to process {file_id}: {e}")

print("\nDone!")
