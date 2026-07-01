import asyncio
import httpx

AUDIO_SERVER_URL = "http://127.0.0.1:8001"

async def test_recording_flow():
    print("=== STARTING COMPLETE RECORDING FLOW SIMULATION ===")
    print("Make sure both ASR (8000) and Audio (8001) servers are running.")
    print("Make sure scripts/test_audio_stream.py is running to stream audio.\n")
    
    async with httpx.AsyncClient() as client:
        # 1. Start recording
        print("1. Sending RECORD_START command to Audio Server...")
        try:
            res = await client.post(f"{AUDIO_SERVER_URL}/record/start")
            if res.status_code == 200:
                print(f"   Success: {res.json()}")
            else:
                print(f"   Error starting recording: {res.status_code} - {res.text}")
                return
        except Exception as e:
            print(f"   Connection error: {e}")
            print("   Please check if servers/audio-server/server.py is running on port 8001.")
            return

        # 2. Wait for 30 seconds
        duration = 30
        print(f"\n2. Simulating recording for {duration} seconds...")
        for remaining in range(duration, 0, -1):
            print(f"   Recording... {remaining} seconds remaining", end="\r", flush=True)
            await asyncio.sleep(1)
        print("\n   Time elapsed.")

        # 3. Stop recording (which triggers saving, uploading, transcribing, and uploading text)
        print("\n3. Sending RECORD_STOP command to Audio Server...")
        print("   Awaiting audio processing and transcription (this will take a few seconds)...")
        try:
            # We increase timeout to 5 minutes to support large audio transcriptions
            res = await client.post(f"{AUDIO_SERVER_URL}/record/stop", timeout=300.0)
            if res.status_code == 200:
                data = res.json()
                print("\n=== RECORDING & TRANSCRIBE FLOW COMPLETED ===")
                print(f"   Saved Local File: {data.get('file')}")
                print(f"   Audio Uploaded to Supabase: {data.get('audio_uploaded')}")
                print(f"   Transcript Uploaded to Supabase: {data.get('transcript_uploaded')}")
                print("\n=== TRANSCRIPTION RESULT ===")
                print(data.get("transcription", ""))
                print("============================\n")
            else:
                print(f"   Error stopping recording: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"   Connection error during stop: {e}")

if __name__ == "__main__":
    asyncio.run(test_recording_flow())
