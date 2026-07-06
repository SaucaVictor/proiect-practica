import os
import sys
import wave
import json
import asyncio
import datetime
import re
import numpy as np
import av
import httpx
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
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
    """
    Walk up from this script's directory until a .env file is found.
    This makes the server work regardless of which directory it is launched from
    (e.g. `python server.py` from inside servers/audio-server/, or
          `python servers/audio-server/server.py` from the project root).
    """
    search_dir = os.path.dirname(os.path.abspath(__file__))
    for _ in range(5):  # walk up at most 5 levels
        candidate = os.path.join(search_dir, ".env")
        if os.path.exists(candidate):
            with open(candidate) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, value = line.partition("=")
                        # Only set if not already in the environment
                        os.environ.setdefault(key.strip(), value.strip())
            print(f"Loaded .env from: {candidate}")
            return
        parent = os.path.dirname(search_dir)
        if parent == search_dir:
            break
        search_dir = parent
    print("WARNING: No .env file found in script directory or any parent directory.")

load_env()
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

# Check if auto-transcribe is enabled via environment variable or CLI argument
AUTO_TRANSCRIBE = ("--auto-transcribe" in sys.argv) or (os.getenv("AUTO_TRANSCRIBE", "false").lower() == "true")
if AUTO_TRANSCRIBE:
    print("AUTO_TRANSCRIBE is ENABLED. Live transcription will auto-start on WebSocket connection.")


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

# ─── Live Transcription State ───
# Managed by the DeepgramRelayManager singleton below.
live_transcription_state = {
    "active": False,
    "starting": False,
    "manager": None,   # DeepgramRelayManager instance
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


# ─── Deepgram Relay Manager ───────────────────────────────────────────────────
class DeepgramRelayManager:
    """
    Opens a WebSocket to Deepgram's /v1/listen API and:
      1. Forwards raw PCM chunks from the ESP32 stream.
      2. Receives transcript JSON responses and saves them to Supabase.
    """

    def __init__(self):
        self.ws = None
        self._send_queue: asyncio.Queue = asyncio.Queue()
        self._recv_task: asyncio.Task | None = None
        self._send_task: asyncio.Task | None = None
        self._session_start: datetime.datetime = datetime.datetime.now(datetime.timezone.utc)
        self._schedule_id: str | None = None
        self._subject_name: str = "Unnamed Lecture"
        # Track the last preliminary segment ID so we can update it
        self._pending_id: str | None = None

    # ── Start / Stop ──────────────────────────────────────────────────────────

    async def start(self):
        """Resolve the active schedule slot, then open the Deepgram WebSocket."""
        self._session_start = datetime.datetime.now(datetime.timezone.utc)
        self._pending_id = None
        await self._resolve_schedule()

        api_key = os.getenv("DEEPGRAM") or os.getenv("DEEPGRAM_API_KEY")
        if not api_key:
            print("[Deepgram] Error: No DEEPGRAM or DEEPGRAM_API_KEY found in environment.")
            self.ws = None
            return

        # Deepgram streaming API URL
        # We request linear16 PCM, 16kHz, mono, nova-2 model, Romanian language, and interim results
        url = (
            "wss://api.deepgram.com/v1/listen"
            "?model=nova-2"
            "&language=ro"
            "&encoding=linear16"
            "&sample_rate=16000"
            "&channels=1"
            "&smart_format=true"
            "&interim_results=true"
        )
        headers = {
            "Authorization": f"Token {api_key}"
        }

        try:
            # Try connecting with additional_headers (websockets >= 14.0)
            self.ws = await websockets.connect(url, additional_headers=headers)
            print(f"[Deepgram] Connected to Deepgram API")
        except TypeError:
            try:
                # Fallback for older websockets versions (< 14.0)
                self.ws = await websockets.connect(url, extra_headers=headers)
                print(f"[Deepgram] Connected to Deepgram API (legacy)")
            except Exception as e:
                print(f"[Deepgram] Could not connect to Deepgram (legacy) at {url}: {e}")
                self.ws = None
                return
        except Exception as e:
            print(f"[Deepgram] Could not connect to Deepgram at {url}: {e}")
            self.ws = None
            return

        self._send_task = asyncio.create_task(self._send_loop())
        self._recv_task = asyncio.create_task(self._recv_loop())

    async def stop(self):
        """Drain the send queue, then close the connection gracefully."""
        # Signal send loop to exit
        await self._send_queue.put(None)
        if self._send_task:
            try:
                await asyncio.wait_for(self._send_task, timeout=5.0)
            except asyncio.TimeoutError:
                self._send_task.cancel()

        if self.ws:
            # Send an empty JSON EOF to Deepgram to gracefully shut down the stream
            try:
                await self.ws.send(json.dumps({"type": "CloseStream"}))
                await asyncio.sleep(0.5)
            except Exception:
                pass
            try:
                await self.ws.close()
            except Exception:
                pass
            self.ws = None

        if self._recv_task:
            self._recv_task.cancel()
            try:
                await self._recv_task
            except asyncio.CancelledError:
                pass

        print("[Deepgram] Relay stopped.")

    # ── Feed audio ────────────────────────────────────────────────────────────

    async def send_pcm(self, data: bytes):
        """Enqueue a raw PCM chunk for forwarding to Deepgram."""
        if self.ws is not None:
            await self._send_queue.put(data)

    # ── Internal loops ────────────────────────────────────────────────────────

    async def _send_loop(self):
        while True:
            chunk = await self._send_queue.get()
            if chunk is None:  # sentinel
                break
            if self.ws:
                try:
                    await self.ws.send(chunk)
                except Exception as e:
                    print(f"[Deepgram] Send error: {e}")
                    break

    async def _recv_loop(self):
        """Receive transcript messages from Deepgram and persist them to Supabase."""
        if not self.ws:
            return
        try:
            async for message in self.ws:
                await self._handle_deepgram_message(message)
        except websockets.exceptions.ConnectionClosed:
            print("[Deepgram] Connection closed by Deepgram.")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[Deepgram] Receive error: {e}")

    async def _handle_deepgram_message(self, raw: str | bytes):
        """Parse a Deepgram response JSON and upsert into Supabase."""
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", errors="replace")

        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return

        # Deepgram results structure:
        # channel -> alternatives -> transcript
        channel = msg.get("channel", {})
        alternatives = channel.get("alternatives", [{}])
        transcript = alternatives[0].get("transcript", "").strip() if alternatives else ""
        
        # If there's no actual transcript content, ignore
        if not transcript:
            return

        is_final = msg.get("is_final", False)
        safe_transcript = transcript.encode("ascii", errors="ignore").decode()
        print(f"[Deepgram] Received: '{safe_transcript}' (final={is_final})")

        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if is_final:
            # Final text received. Upsert or update our pending preview, and mark it as final
            if self._pending_id:
                await self._update_segment(self._pending_id, transcript, is_final=True)
                self._pending_id = None
            else:
                # If no pending preview existed, insert a new final segment
                await self._upsert_segment(
                    text=transcript,
                    is_final=True,
                    segment_start=now,
                    segment_end=now,
                )
        else:
            # Interim/preliminary text. Update existing pending segment or create a new one
            if self._pending_id:
                await self._update_segment(self._pending_id, transcript, is_final=False)
            else:
                row_id = await self._upsert_segment(
                    text=transcript,
                    is_final=False,
                    segment_start=now,
                    segment_end=None,
                )
                self._pending_id = row_id

    # ── Supabase helpers ──────────────────────────────────────────────────────

    async def _resolve_schedule(self):
        """
        Look up the active schedule slot for the current day/time.
        Sets self._schedule_id and self._subject_name.
        """
        if not SUPABASE_URL or not SUPABASE_KEY:
            return

        now = datetime.datetime.now()
        day_of_week = now.isoweekday()   # 1=Mon … 5=Fri
        current_time = now.strftime("%H:%M:%S")

        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        url = f"{SUPABASE_URL}/rest/v1/rpc/resolve_schedule_slot"
        payload = {
            "p_day_of_week": day_of_week,
            "p_time": current_time
        }
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    rows = res.json()
                    if rows:
                        self._schedule_id = rows[0]["id"]
                        self._subject_name = rows[0]["subject_name"]
                        safe_subject = self._subject_name.encode("ascii", errors="ignore").decode()
                        print(f"[Deepgram] Active schedule slot: {safe_subject} (id={self._schedule_id})")
                    else:
                        print("[Deepgram] No active schedule slot found — using 'Unnamed Lecture'")
        except Exception as e:
            print(f"[Deepgram] Schedule lookup error: {e}")

    async def _upsert_segment(
        self,
        text: str,
        is_final: bool,
        segment_start: str,
        segment_end: str | None,
    ) -> str | None:
        """Insert a new live_transcripts row and return its UUID."""
        if not SUPABASE_URL or not SUPABASE_KEY:
            return None

        payload = {
            "subject_name": self._subject_name,
            "session_date": self._session_start.date().isoformat(),
            "segment_start": segment_start,
            "segment_end": segment_end,
            "text": text,
            "is_final": is_final,
        }
        if self._schedule_id:
            payload["schedule_id"] = self._schedule_id

        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",  # return the created row
        }
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                     f"{SUPABASE_URL}/rest/v1/live_transcripts",
                     json=payload,
                     headers=headers,
                )
                if res.status_code in (200, 201):
                    rows = res.json()
                    if rows:
                        row_id = rows[0].get("id")
                        safe_text = text.encode("ascii", errors="ignore").decode()
                        print(f"[Deepgram] Upserted segment (final={is_final}): text='{safe_text}', id={row_id}")
                        return row_id
                else:
                    safe_res_text = res.text.encode("ascii", errors="ignore").decode()
                    print(f"[Deepgram] Supabase insert error {res.status_code}: {safe_res_text}")
        except Exception as e:
            print(f"[Deepgram] Supabase insert exception: {e}")
        return None

    async def _update_segment(self, row_id: str, text: str, is_final: bool):
        """Update an existing preliminary segment with new text."""
        if not SUPABASE_URL or not SUPABASE_KEY:
            return

        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        payload = {
            "text": text,
            "is_final": is_final,
            "segment_end": now if is_final else None,
        }
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient() as client:
                res = await client.patch(
                    f"{SUPABASE_URL}/rest/v1/live_transcripts?id=eq.{row_id}",
                    json=payload,
                    headers=headers,
                )
                if res.status_code in (200, 204):
                    safe_text = text.encode("ascii", errors="ignore").decode()
                    print(f"[Deepgram] Updated segment: id={row_id}, text='{safe_text}', final={is_final}")
                else:
                    safe_res_text = res.text.encode("ascii", errors="ignore").decode()
                    print(f"[Deepgram] Supabase update error {res.status_code}: {safe_res_text}")
        except Exception as e:
            print(f"[Deepgram] Supabase update exception: {e}")


# ─── Helper Functions for Recording ───
async def start_recording_internal():
    if recording_state["active"]:
        print("Recording already active.")
        return {"status": "already_active"}
    
    recording_state["active"] = True
    recording_state["buffer"] = bytearray()
    recording_state["start_time"] = datetime.datetime.now()
    print(f"Recording started at {recording_state['start_time']}")
    return {"status": "started"}

async def stop_recording_internal():
    if not recording_state["active"]:
        print("No active recording to stop.")
        return {"status": "not_active"}
    
    recording_state["active"] = False
    print("Recording stopped. Saving file...")
    
    filename = recording_state["filename"]
    start_time = recording_state.get("start_time") or datetime.datetime.now()
    try:
        # Save raw 16kHz mono PCM to a valid WAV file
        with wave.open(filename, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(16000)
            wav_file.writeframes(recording_state["buffer"])
        print(f"Saved recording locally: {filename}")
        return {"status": "stopped", "file": filename, "start_time": start_time}
    except Exception as e:
        print(f"Failed to save recording file: {e}")
        return {"status": "error", "message": str(e)}


# ─── Live transcription start/stop helpers ────────────────────────────────────

async def start_live_transcription():
    if live_transcription_state["active"] or live_transcription_state.get("starting"):
        print("[Deepgram] Live transcription already active or starting.")
        return
    live_transcription_state["starting"] = True
    try:
        manager = DeepgramRelayManager()
        await manager.start()
        if manager.ws is None:
            print("[Deepgram] Connection failed, live transcription not active.")
            return
        live_transcription_state["manager"] = manager
        live_transcription_state["active"] = True
        print("[Deepgram] Live transcription started.")
    finally:
        live_transcription_state["starting"] = False

async def stop_live_transcription():
    if not live_transcription_state["active"]:
        return
    manager = live_transcription_state["manager"]
    if manager:
        await manager.stop()
    live_transcription_state["manager"] = None
    live_transcription_state["active"] = False
    print("[Deepgram] Live transcription stopped.")

async def feed_live_transcription(data: bytes):
    if live_transcription_state["active"]:
        manager = live_transcription_state["manager"]
        if manager:
            await manager.send_pcm(data)


# ─── Text Chunking and Embedding Generation for RAG ───
def chunk_text(text: str, size: int = 800, overlap: int = 120) -> list[str]:
    # Normalize excessive white spaces
    normalized = re.sub(r'\s+', ' ', text).strip()
    chunks = []
    start = 0
    while start < len(normalized):
        end = min(start + size, len(normalized))
        chunk = normalized[start:end].strip()
        if len(chunk) > 20:
            chunks.append(chunk)
        start += size - overlap
    return chunks


async def generate_embedding(text: str, input_type: str = "passage") -> list[float]:
    nvidia_key = os.getenv("VITE_NVIDIA_API_KEY")
    if not nvidia_key:
        raise ValueError("[RAG] VITE_NVIDIA_API_KEY is not configured in the environment")
        
    url = "https://integrate.api.nvidia.com/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {nvidia_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "input": [text],
        "model": "nvidia/nv-embedqa-e5-v5",
        "input_type": input_type,
        "encoding_format": "float",
        "truncate": "END"
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=payload, headers=headers, timeout=30.0)
        if res.status_code != 200:
            raise Exception(f"[RAG] NVIDIA API error {res.status_code}: {res.text}")
        data = res.json()
        return data["data"][0]["embedding"]


async def upload_and_transcribe_task(filename: str, start_time: datetime.datetime = None):
    print("Background upload & transcribe task started...")
    
    if start_time is None:
        start_time = datetime.datetime.now()
        
    course_name = "Unscheduled"
    course_date = start_time.strftime("%Y-%m-%d")
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            day_of_week = start_time.isoweekday()
            current_time = start_time.strftime("%H:%M:%S")
            url = f"{SUPABASE_URL}/rest/v1/rpc/resolve_schedule_slot"
            payload = {
                "p_day_of_week": day_of_week,
                "p_time": current_time
            }
            headers_rpc = headers.copy()
            headers_rpc["Content-Type"] = "application/json"
            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, headers=headers_rpc)
                if res.status_code == 200:
                    rows = res.json()
                    if rows and rows[0].get("subject_name"):
                        course_name = rows[0]["subject_name"]
                        print(f"[RAG] Matched schedule subject: {course_name}")
                    else:
                        print("[RAG] No matching schedule slot found. Using fallback 'Unscheduled'.")
        except Exception as e:
            print(f"[RAG] Error querying schedule for start_time {start_time}: {e}")
            
    start_hour = start_time.strftime("%H-%M-%S")
    audio_filename = f"{start_hour}_{course_name}_audio.wav"
    transcript_filename = f"{start_hour}_{course_name}_transcript.txt"
    
    audio_path = f"{course_name}/{course_date}/{audio_filename}"
    text_path = f"{course_name}/{course_date}/{transcript_filename}"
    
    storage_url = f"{SUPABASE_URL}/storage/v1/object/courses/{audio_path}"
    headers_audio = headers.copy()
    headers_audio["Content-Type"] = "audio/wav"
    
    # Read the file
    if not os.path.exists(filename):
        print(f"Error: Recording file {filename} not found.")
        return {
            "transcription": "",
            "audio_uploaded": False,
            "transcript_uploaded": False,
            "error": "File not found"
        }
        
    with open(filename, "rb") as f:
        file_bytes = f.read()

    # 1. Upload audio to Supabase Storage
    audio_uploaded = False
    print("Uploading audio to Supabase Storage...")
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(storage_url, content=file_bytes, headers=headers_audio)
            if res.status_code == 200:
                print(f"Successfully uploaded audio at: {audio_path}")
                audio_uploaded = True
            elif res.status_code == 400 and ("AlreadyExists" in res.text or "Duplicate" in res.text or "exists" in res.text):
                res_put = await client.put(storage_url, content=file_bytes, headers=headers_audio)
                if res_put.status_code == 200:
                    print("Successfully updated audio in Supabase Storage.")
                    audio_uploaded = True
            else:
                print(f"Error uploading audio: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"Failed to upload audio file: {e}")

    # 2. Call Deepgram REST API for batch transcription
    api_key = os.getenv("DEEPGRAM") or os.getenv("DEEPGRAM_API_KEY")
    transcription_text = ""
    if api_key:
        print("Forwarding audio to Deepgram for batch transcription...")
        try:
            headers_dg = {
                "Authorization": f"Token {api_key}",
                "Content-Type": "audio/wav"
            }
            url_dg = "https://api.deepgram.com/v1/listen?model=nova-2&language=ro&smart_format=true"
            async with httpx.AsyncClient(timeout=300.0) as client:
                res = await client.post(url_dg, content=file_bytes, headers=headers_dg)
                if res.status_code == 200:
                    response_json = res.json()
                    transcription_text = (
                        response_json.get("results", {})
                        .get("channels", [{}])[0]
                        .get("alternatives", [{}])[0]
                        .get("transcript", "")
                    )
                    safe_text = transcription_text[:100].encode("ascii", errors="ignore").decode()
                    print(f"Deepgram batch transcription complete: {safe_text}...")
                else:
                    safe_res_text = res.text.encode("ascii", errors="ignore").decode()
                    print(f"Deepgram ASR returned status {res.status_code}: {safe_res_text}")
        except Exception as e:
            print(f"Failed to connect to Deepgram for batch transcription: {e}")
    else:
        print("[Deepgram] Error: No DEEPGRAM or DEEPGRAM_API_KEY found. Batch transcription skipped.")

    # 3. Upload transcript to Supabase Storage
    transcript_uploaded = False
    if transcription_text:
        print("Uploading transcript to Supabase Storage...")
        text_url = f"{SUPABASE_URL}/storage/v1/object/courses/{text_path}"
        headers_text = headers.copy()
        headers_text["Content-Type"] = "text/plain"
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(text_url, content=transcription_text.encode("utf-8"), headers=headers_text)
                if res.status_code == 200:
                    print(f"Successfully uploaded transcript at: {text_path}")
                    transcript_uploaded = True
                elif res.status_code == 400 and ("AlreadyExists" in res.text or "Duplicate" in res.text or "exists" in res.text):
                    res_put = await client.put(text_url, content=transcription_text.encode("utf-8"), headers=headers_text)
                    if res_put.status_code == 200:
                        print("Successfully updated transcript in Supabase Storage.")
                        transcript_uploaded = True
        except Exception as e:
            print(f"Failed to upload transcript: {e}")
            
    # Index transcript for RAG in Supabase
    if transcript_uploaded and transcription_text.strip():
        print("[RAG] Ingesting transcription chunks & embeddings...")
        try:
            chunks = chunk_text(transcription_text)
            if chunks:
                embeddings = []
                for chunk in chunks:
                    emb = await generate_embedding(chunk, "passage")
                    embeddings.append(emb)
                
                rpc_url = f"{SUPABASE_URL}/rest/v1/rpc/register_and_index_transcript"
                rpc_payload = {
                    "p_subject_name": course_name,
                    "p_session_date": course_date,
                    "p_file_name": transcript_filename,
                    "p_file_path": f"courses/{text_path}",
                    "p_file_size": len(transcription_text),
                    "p_chunks": chunks,
                    "p_embeddings": embeddings
                }
                async with httpx.AsyncClient() as client:
                    res = await client.post(rpc_url, json=rpc_payload, headers=headers)
                    if res.status_code in (200, 204):
                        print("[RAG] Successfully indexed transcript in DB.")
                    else:
                        print(f"[RAG] Failed to index transcript via RPC {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[RAG] Exception during transcript indexing: {e}")

    # Clean up local file
    try:
        if os.path.exists(filename):
            os.remove(filename)
            print("Cleaned up local recording file.")
    except Exception as e:
        print(f"Failed cleaning up file: {e}")

    return {
        "transcription": transcription_text,
        "audio_uploaded": audio_uploaded,
        "transcript_uploaded": transcript_uploaded
    }

# ─── HTTP Endpoints to Control Recording ───
@app.post("/record/start")
async def record_start():
    result = await start_recording_internal()
    if result["status"] == "started":
        # Also kick off live transcription relay
        asyncio.create_task(start_live_transcription())
    return result

@app.post("/record/stop")
async def record_stop():
    # Stop live transcription relay first
    asyncio.create_task(stop_live_transcription())
    res = await stop_recording_internal()
    if res["status"] == "stopped":
        results = await upload_and_transcribe_task(res["file"], res.get("start_time"))
        return {
            "status": "completed",
            "file": res["file"],
            "transcription": results["transcription"],
            "audio_uploaded": results["audio_uploaded"],
            "transcript_uploaded": results["transcript_uploaded"]
        }
    return res

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    api_key = os.getenv("DEEPGRAM") or os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        print("[Deepgram] Error: DEEPGRAM API key not configured on backend.")
        raise HTTPException(status_code=500, detail="DEEPGRAM API key not configured on backend.")
    
    file_bytes = await file.read()
    print(f"[Deepgram] /transcribe request received: filename='{file.filename}', content_type='{file.content_type}', size={len(file_bytes)} bytes")
    
    try:
        headers_dg = {
            "Authorization": f"Token {api_key}",
            "Content-Type": file.content_type or "audio/wav"
        }
        url_dg = "https://api.deepgram.com/v1/listen?model=nova-2&language=ro&smart_format=true"
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.post(url_dg, content=file_bytes, headers=headers_dg)
            print(f"[Deepgram] HTTP POST request to Deepgram API. Status: {res.status_code}")
            if res.status_code == 200:
                response_json = res.json()
                transcription_text = (
                    response_json.get("results", {})
                    .get("channels", [{}])[0]
                    .get("alternatives", [{}])[0]
                    .get("transcript", "")
                )
                print(f"[Deepgram] Successful transcription. Result: '{transcription_text.strip()}'")
                return {"text": transcription_text.strip()}
            else:
                print(f"[Deepgram] Error: Deepgram API returned status {res.status_code}. Response: {res.text}")
                raise HTTPException(status_code=res.status_code, detail=f"Deepgram returned error: {res.text}")
    except Exception as e:
        print(f"[Deepgram] Exception occurred during transcription: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── ESP32 WebSocket Endpoint ───
@app.websocket("/ws/audio")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("ESP32 microcontroler conectat la /ws/audio!")
    if AUTO_TRANSCRIBE:
        print("[Deepgram] Auto-transcribe is enabled. Starting live transcription...")
        asyncio.create_task(start_live_transcription())
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
                # Forward to Deepgram ASR relay (non-blocking)
                await feed_live_transcription(data)
                    
            elif "text" in result:
                text_cmd = result["text"]
                print(f"WebSocket text command received: {text_cmd}")
                if text_cmd == "RECORD_START":
                    res = await start_recording_internal()
                    if res["status"] == "started":
                        asyncio.create_task(start_live_transcription())
                elif text_cmd == "RECORD_STOP":
                    asyncio.create_task(stop_live_transcription())
                    res = await stop_recording_internal()
                    if res["status"] == "stopped":
                        asyncio.create_task(upload_and_transcribe_task(res["file"], res.get("start_time")))
                    
    except WebSocketDisconnect:
        print("ESP32 microcontroler s-a deconectat.")
    except RuntimeError as re:
        if "Cannot call" in str(re):
            print("WebSocket ESP32 s-a închis.")
        else:
            print(f"Eroare WebSocket ESP32 (RuntimeError): {re}")
    except Exception as e:
        print(f"Eroare WebSocket ESP32: {e}")
    finally:
        if AUTO_TRANSCRIBE:
            print("[Deepgram] Auto-transcribe is stopping live transcription...")
            asyncio.create_task(stop_live_transcription())

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
    print(f"[*] AUTO_TRANSCRIBE is {'ENABLED' if AUTO_TRANSCRIBE else 'DISABLED'}")
    asyncio.create_task(signaling_loop())

if __name__ == "__main__":
    import uvicorn
    # Start on port 8001, listening on all interfaces to allow ESP32 connection
    uvicorn.run(app, host="0.0.0.0", port=8001)
