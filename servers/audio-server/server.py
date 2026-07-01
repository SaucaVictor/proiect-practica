import os
import wave
import asyncio
import numpy as np
import av
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack, RTCConfiguration, RTCIceServer

app = FastAPI(title="ClassMonitor Audio Server")

# Enable CORS for frontend compatibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Load Environment Variables ───
def load_env():
    if os.path.exists(".env"):
        with open(".env") as f:
            for line in f:
                if line.strip() and not line.startswith("#"):
                    parts = line.strip().split("=", 1)
                    if len(parts) == 2:
                        os.environ[parts[0]] = parts[1].strip()

load_env()
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("WARNING: Supabase credentials not found in .env. WebRTC signaling will not work.")

# ─── Global State for Streaming ───
active_tracks = set()
active_connections = set()
processed_session_ids = set()

# ─── Recording State ───
recording_state = {
    "active": False,
    "buffer": bytearray(),
    "filename": "recording.wav"
}

# ─── Custom WebRTC Audio Track ───
class AudioStreamTrack(MediaStreamTrack):
    kind = "audio"

    def __init__(self):
        super().__init__()
        self.queue = asyncio.Queue()
        self.buffer = bytearray()
        self.sample_rate = 16000
        self.channels = 1
        self.pts = 0
        active_tracks.add(self)
        print("WebRTC AudioTrack initialized and registered.")

    def stop(self):
        super().stop()
        if self in active_tracks:
            active_tracks.remove(self)
            print("WebRTC AudioTrack stopped and unregistered.")

    async def recv(self):
        # We need 20ms of audio frames at 16kHz
        # 16000 samples/sec * 0.020 sec = 320 samples
        # Each sample is a 16-bit signed integer (2 bytes) -> 640 bytes
        required_bytes = 640
        
        while len(self.buffer) < required_bytes:
            # Check if the queue is growing too large (backpressure / lag mitigation)
            if self.queue.qsize() > 50:
                try:
                    for _ in range(25):
                        self.queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass

            data = await self.queue.get()
            self.buffer.extend(data)

        # Extract 20ms frame
        chunk = bytes(self.buffer[:required_bytes])
        del self.buffer[:required_bytes]

        # Convert bytes to numpy s16 array
        samples = np.frombuffer(chunk, dtype=np.int16)
        
        # Build PyAV AudioFrame
        frame = av.AudioFrame.from_ndarray(
            samples.reshape(1, -1),
            format="s16",
            layout="mono"
        )
        frame.sample_rate = self.sample_rate
        frame.pts = self.pts
        self.pts += frame.samples
        
        return frame

# ─── Helper Functions for Recording ───
async def start_recording_internal():
    if recording_state["active"]:
        print("Recording already active.")
        return {"status": "already_active"}
    
    recording_state["active"] = True
    recording_state["buffer"] = bytearray()
    print("Recording started.")
    return {"status": "started"}

async def stop_recording_internal():
    if not recording_state["active"]:
        print("No active recording to stop.")
        return {"status": "not_active"}
    
    recording_state["active"] = False
    print("Recording stopped. Saving file...")
    
    filename = recording_state["filename"]
    try:
        # Save raw 16kHz mono PCM to a valid WAV file
        with wave.open(filename, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(16000)
            wav_file.writeframes(recording_state["buffer"])
        print(f"Saved recording locally: {filename}")
        
        # Trigger upload and transcription in a background task
        asyncio.create_task(upload_and_transcribe_task(filename))
        return {"status": "stopped", "file": filename}
    except Exception as e:
        print(f"Failed to save recording file: {e}")
        return {"status": "error", "message": str(e)}

async def upload_and_transcribe_task(filename):
    print("Background upload & transcribe task started...")
    
    # Test path in courses bucket
    course_name = "Materia_Test"
    course_date = "2026-07-01"
    
    audio_path = f"{course_name}/{course_date}/audio.wav"
    storage_url = f"{SUPABASE_URL}/storage/v1/object/courses/{audio_path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "audio/wav"
    }
    
    # Read the file
    if not os.path.exists(filename):
        print(f"Error: Recording file {filename} not found.")
        return
        
    with open(filename, "rb") as f:
        file_bytes = f.read()

    # 1. Upload audio to Supabase Storage
    print("Uploading audio to Supabase Storage...")
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(storage_url, content=file_bytes, headers=headers)
            if res.status_code == 200:
                print(f"Successfully uploaded audio at: {audio_path}")
            elif res.status_code == 400 and "AlreadyExists" in res.text:
                await client.put(storage_url, content=file_bytes, headers=headers)
                print("Successfully updated audio in Supabase Storage.")
            else:
                print(f"Error uploading audio: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"Failed to upload audio file: {e}")

    # 2. Call separate ASR server (port 8000) for transcription
    asr_url = "http://127.0.0.1:8000/transcribe"
    print(f"Forwarding audio to ASR server ({asr_url}) for Whisper transcription...")
    transcription_text = ""
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            with open(filename, "rb") as f:
                files = {"file": (filename, f, "audio/wav")}
                res = await client.post(asr_url, files=files)
            if res.status_code == 200:
                transcription_text = res.json().get("text", "")
                print(f"ASR Server transcription complete: {transcription_text[:100]}...")
            else:
                print(f"ASR Server returned status {res.status_code}: {res.text}")
    except Exception as e:
        print(f"Failed to connect to ASR server on port 8000: {e}")

    # 3. Upload transcript to Supabase Storage
    if transcription_text:
        print("Uploading transcript to Supabase Storage...")
        text_path = f"{course_name}/{course_date}/transcript.txt"
        text_url = f"{SUPABASE_URL}/storage/v1/object/courses/{text_path}"
        headers["Content-Type"] = "text/plain"
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(text_url, content=transcription_text.encode("utf-8"), headers=headers)
                if res.status_code == 200:
                    print(f"Successfully uploaded transcript at: {text_path}")
                elif res.status_code == 400 and "AlreadyExists" in res.text:
                    await client.put(text_url, content=transcription_text.encode("utf-8"), headers=headers)
                    print("Successfully updated transcript in Supabase Storage.")
        except Exception as e:
            print(f"Failed to upload transcript: {e}")
            
    # Clean up local file
    try:
        if os.path.exists(filename):
            os.remove(filename)
            print("Cleaned up local recording file.")
    except Exception as e:
        print(f"Failed cleaning up file: {e}")

# ─── HTTP Endpoints to Control Recording ───
@app.post("/record/start")
async def record_start():
    return await start_recording_internal()

@app.post("/record/stop")
async def record_stop():
    return await stop_recording_internal()

# ─── ESP32 WebSocket Endpoint ───
@app.websocket("/ws/audio")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("ESP32 microcontroler conectat la /ws/audio!")
    try:
        while True:
            # We use websocket.receive() to support both binary and text frames
            result = await websocket.receive()
            
            if "bytes" in result:
                data = result["bytes"]
                # Broadcast to WebRTC tracks
                for track in list(active_tracks):
                    await track.queue.put(data)
                # Accumulate into recording buffer
                if recording_state["active"]:
                    recording_state["buffer"].extend(data)
                    
            elif "text" in result:
                text_cmd = result["text"]
                print(f"WebSocket text command received: {text_cmd}")
                if text_cmd == "RECORD_START":
                    await start_recording_internal()
                elif text_cmd == "RECORD_STOP":
                    await stop_recording_internal()
                    
    except WebSocketDisconnect:
        print("ESP32 microcontroler s-a deconectat.")
    except Exception as e:
        print(f"Eroare WebSocket ESP32: {e}")

# ─── WebRTC Signaling Database Loop ───
async def handle_offer(offer_row):
    session_id = offer_row["session_id"]
    offer_sdp = offer_row["sdp"]
    print(f"New connection request for WebRTC session: {session_id}")

    # Use Google's public STUN server for NAT traversal
    config = RTCConfiguration(iceServers=[RTCIceServer(urls="stun:stun.l.google.com:19302")])
    pc = RTCPeerConnection(configuration=config)
    active_connections.add(pc)

    track = AudioStreamTrack()
    pc.addTrack(track)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print(f"WebRTC session {session_id} state changed to: {pc.connectionState}")
        if pc.connectionState in ["failed", "closed"]:
            await pc.close()
            track.stop()
            if pc in active_connections:
                active_connections.remove(pc)

    try:
        # Set Remote Offer SDP
        await pc.setRemoteDescription(RTCSessionDescription(sdp=offer_sdp, type="offer"))
        
        # Create Local Answer SDP
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        # Wait for ICE gathering to complete (Vanilla ICE)
        print(f"Gathering ICE candidates for session {session_id}...")
        while pc.iceGatheringState != "complete":
            await asyncio.sleep(0.1)

        # Push Answer back to Supabase
        answer_payload = {
            "session_id": session_id,
            "sender": "server",
            "type": "answer",
            "sdp": pc.localDescription.sdp
        }
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{SUPABASE_URL}/rest/v1/webrtc_signaling",
                json=answer_payload,
                headers=headers
            )
            if res.status_code >= 300:
                print(f"Error sending answer to Supabase for {session_id}: {res.text}")
            else:
                print(f"WebRTC Answer successfully saved to Supabase for session {session_id}")

    except Exception as e:
        print(f"Failed handling WebRTC offer for {session_id}: {e}")
        await pc.close()
        track.stop()
        if pc in active_connections:
            active_connections.remove(pc)

async def signaling_loop():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Signaling loop aborted: Supabase credentials missing.")
        return

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }

    print("Supabase WebRTC Signaling Loop started.")
    while True:
        try:
            async with httpx.AsyncClient() as client:
                # Query for offers sent by clients
                res = await client.get(
                    f"{SUPABASE_URL}/rest/v1/webrtc_signaling?sender=eq.client&type=eq.offer&order=created_at.desc&limit=1",
                    headers=headers
                )
                if res.status_code == 200:
                    rows = res.json()
                    if rows:
                        offer = rows[0]
                        session_id = offer["session_id"]
                        if session_id not in processed_session_ids:
                            processed_session_ids.add(session_id)
                            # Handle offer asynchronously
                            asyncio.create_task(handle_offer(offer))
        except Exception as e:
            print(f"Error in signaling loop: {e}")
        
        await asyncio.sleep(1.0) # Poll every 1 second

# Start signaling loop task on FastAPI startup
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(signaling_loop())

if __name__ == "__main__":
    import uvicorn
    # Start on port 8001
    uvicorn.run(app, host="127.0.0.1", port=8001)
