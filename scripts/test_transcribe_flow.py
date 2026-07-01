import os
import sys
import httpx

# Configuration - using the shared test audio file relative to the script location
DEFAULT_FILE_PATH = os.path.join(os.path.dirname(__file__), "audio-test.mp3")
ASR_SERVER_URL = "http://127.0.0.1:8000/transcribe"

# Test destination inside the 'courses' bucket:
# /courses/Materia_Test/2026-07-01/audio.mp3
# /courses/Materia_Test/2026-07-01/transcript.txt
COURSE_NAME = "Materia_Test"
COURSE_DATE = "2026-07-01"

def load_env():
    env_vars = {}
    if os.path.exists(".env"):
        with open(".env") as f:
            for line in f:
                if line.strip() and not line.startswith("#"):
                    parts = line.strip().split("=", 1)
                    if len(parts) == 2:
                        env_vars[parts[0]] = parts[1].strip()
    return env_vars

async def run_flow():
    print("=== STARTING RECORDING & TRANSCRIPTION MOCK FLOW ===")
    
    # Check if a custom file path is provided as argument
    file_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_FILE_PATH
        
    if not os.path.exists(file_path):
        print(f"Error: Test file not found at: {file_path}")
        return

    print(f"Loaded test audio file: {file_path}")
    print(f"File size: {os.path.getsize(file_path) / (1024*1024):.2f} MB")

    # Load Supabase credentials
    env = load_env()
    supabase_url = env.get("VITE_SUPABASE_URL")
    supabase_key = env.get("VITE_SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_key:
        print("Error: Supabase credentials not found in .env file.")
        return

    # 2. Upload to Local ASR Server for Transcription (running on port 8000)
    print(f"\n1. Sending audio to local ASR server ({ASR_SERVER_URL}) for transcription...")
    print("   Please wait, this might take a moment depending on the file duration...")
    
    transcription_text = ""
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            with open(file_path, "rb") as f:
                files = {"file": (os.path.basename(file_path), f, "audio/mpeg")}
                res = await client.post(ASR_SERVER_URL, files=files)
                
            if res.status_code == 200:
                transcription_text = res.json().get("text", "")
                print("\n=== TRANSCRIPTION COMPLETE ===")
                print(transcription_text[:500] + ("..." if len(transcription_text) > 500 else ""))
                print("==============================\n")
            else:
                print(f"Error: ASR Server returned status {res.status_code}: {res.text}")
                return
    except Exception as e:
        print(f"Error connecting to ASR Server: {e}")
        print("Make sure servers/speech-to-text/server.py is running on port 8000.")
        return

    # 3. Upload Audio File to Supabase Storage
    print("2. Uploading raw audio file to Supabase Storage ('courses' bucket)...")
    audio_path = f"{COURSE_NAME}/{COURSE_DATE}/audio.mp3"
    storage_url = f"{supabase_url}/storage/v1/object/courses/{audio_path}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "audio/mpeg"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            with open(file_path, "rb") as f:
                file_bytes = f.read()
                
            res = await client.post(storage_url, content=file_bytes, headers=headers)
            if res.status_code == 200:
                print(f"   Successfully uploaded audio to Supabase Storage at: {audio_path}")
            elif res.status_code == 400 and "AlreadyExists" in res.text:
                # If already exists, overwrite using PUT
                print("   File already exists, overwriting via PUT...")
                res_put = await client.put(storage_url, content=file_bytes, headers=headers)
                if res_put.status_code == 200:
                     print(f"   Successfully overwrote audio in Supabase Storage.")
                else:
                     print(f"   Error overwriting audio: {res_put.status_code} - {res_put.text}")
            else:
                print(f"   Error uploading audio: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"   Error uploading audio: {e}")

    # 4. Upload Text Transcript to Supabase Storage
    print("\n3. Uploading transcript text to Supabase Storage ('courses' bucket)...")
    text_path = f"{COURSE_NAME}/{COURSE_DATE}/transcript.txt"
    text_url = f"{supabase_url}/storage/v1/object/courses/{text_path}"
    headers["Content-Type"] = "text/plain"
    
    try:
        async with httpx.AsyncClient() as client:
            text_bytes = transcription_text.encode("utf-8")
            res = await client.post(text_url, content=text_bytes, headers=headers)
            if res.status_code == 200:
                print(f"   Successfully uploaded transcript to Supabase Storage at: {text_path}")
            elif res.status_code == 400 and "AlreadyExists" in res.text:
                # If already exists, overwrite using PUT
                print("   File already exists, overwriting via PUT...")
                res_put = await client.put(text_url, content=text_bytes, headers=headers)
                if res_put.status_code == 200:
                     print(f"   Successfully overwrote transcript in Supabase Storage.")
                else:
                     print(f"   Error overwriting transcript: {res_put.status_code} - {res_put.text}")
            else:
                print(f"   Error uploading transcript: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"   Error uploading transcript: {e}")

    print("\n=== MOCK FLOW COMPLETED ===")

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_flow())
