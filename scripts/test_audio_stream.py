import os
import sys
import math
import time
import asyncio
import argparse
import numpy as np
import websockets
import av

# Path to the shared test audio file relative to the script location
DEFAULT_MUSIC_PATH = os.path.join(os.path.dirname(__file__), "audio-test.mp3")
WS_URI = "ws://127.0.0.1:8001/ws/audio"

# ─── Audio Generators ──────────────────────────────────────────────────────────

async def stream_tone(websocket):
    print("Streaming simulated 440Hz tone in real-time...")
    sample_rate = 16000
    frequency = 440.0
    amplitude = 8000
    frame_duration = 0.020  # 20ms
    samples_per_frame = int(sample_rate * frame_duration)  # 320
    time_offset = 0.0

    while True:
        t = np.linspace(time_offset, time_offset + frame_duration, samples_per_frame, endpoint=False)
        mod_frequency = frequency + 100 * math.sin(time_offset * 3)
        audio_samples = (amplitude * np.sin(2 * np.pi * mod_frequency * t)).astype(np.int16)
        await websocket.send(audio_samples.tobytes())
        time_offset += frame_duration
        await asyncio.sleep(frame_duration)

async def stream_music_file(websocket, file_path):
    print(f"Opening audio file: {file_path}")
    
    # Check if file exists
    if not os.path.exists(file_path):
        print(f"Error: Audio file not found at {file_path}")
        print("Falling back to simulated tone...")
        await stream_tone(websocket)
        return

    # Loop audio indefinitely
    while True:
        print("Starting audio playback loop...")
        container = av.open(file_path)
        audio_stream = container.streams.audio[0]
        
        # Configure resampler to 16kHz Mono 16-bit Signed PCM
        resampler = av.AudioResampler(
            format='s16',
            layout='mono',
            rate=16000
        )
        
        buffer = bytearray()
        chunk_size = 640  # 20ms at 16kHz mono 16-bit
        start_time = time.time()
        bytes_sent = 0

        try:
            for packet in container.demux(audio_stream):
                for frame in packet.decode():
                    resampled_frames = resampler.resample(frame)
                    if resampled_frames:
                        for r_frame in resampled_frames:
                            data = r_frame.to_ndarray().tobytes()
                            buffer.extend(data)
                            
                            while len(buffer) >= chunk_size:
                                chunk = bytes(buffer[:chunk_size])
                                del buffer[:chunk_size]
                                
                                await websocket.send(chunk)
                                bytes_sent += chunk_size
                                
                                # Real-time pacing clock
                                expected_elapsed = (bytes_sent / 2) / 16000
                                actual_elapsed = time.time() - start_time
                                sleep_time = expected_elapsed - actual_elapsed
                                
                                if sleep_time > 0:
                                    await asyncio.sleep(sleep_time)
                                    
        except Exception as e:
            print(f"Error during audio decoding/streaming: {e}")
        finally:
            container.close()
            
        print("Finished file playback. Restarting track...")
        await asyncio.sleep(1.0) # Short delay before restart


# ─── Live Transcription Test ───────────────────────────────────────────────────

async def stream_with_live_transcription(websocket, file_path, duration_secs: int = 30):
    """
    Send RECORD_START, stream audio for `duration_secs`, then RECORD_STOP.
    This exercises the full live-transcription pipeline:
      1. Audio server receives RECORD_START → opens Deepgram WebSocket relay.
      2. PCM frames arrive → forwarded to Deepgram.
      3. Deepgram returns transcript JSON → audio server saves to Supabase live_transcripts.
      4. After `duration_secs`, RECORD_STOP is sent → relay closes, WAV saved, batch
         transcription runs via Deepgram's REST API.

    Watch the audio server console for [Deepgram] log lines.
    Check Supabase live_transcripts table for rows accumulating in real-time.
    """
    print(f"\n{'='*60}")
    print(f"  Live Transcription Test  ({duration_secs}s)")
    print(f"{'='*60}")
    print("  Sending RECORD_START ...")
    await websocket.send("RECORD_START")
    await asyncio.sleep(0.2)  # small delay so server opens WLK connection first

    print(f"  Streaming audio for {duration_secs}s — check Supabase live_transcripts for live rows")
    print(f"  (Ctrl+C to abort early)\n")

    # Stream for a fixed duration then stop
    start = time.time()

    if not os.path.exists(file_path):
        print(f"  No audio file at {file_path}, using 440Hz tone instead.")
        stream_coro = stream_tone(websocket)
    else:
        stream_coro = stream_music_file(websocket, file_path)

    stream_task = asyncio.create_task(stream_coro)

    try:
        await asyncio.sleep(duration_secs)
    except asyncio.CancelledError:
        pass
    finally:
        stream_task.cancel()
        try:
            await stream_task
        except (asyncio.CancelledError, Exception):
            pass

    elapsed = round(time.time() - start, 1)
    print(f"\n  Sending RECORD_STOP after {elapsed}s ...")
    await websocket.send("RECORD_STOP")
    print("  Done! Check the audio server logs for the batch transcription result.")
    print(f"{'='*60}\n")


# ─── Main ──────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(
        description="ClassMonitor Audio Stream Test Client",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Modes:
  stream  (default)  Continuously stream audio to the server, simulating the
                     ESP32 microphone. Use this to test WebRTC live audio.

  live               Send RECORD_START, stream for --duration seconds, then
                     RECORD_STOP. Tests the full WhisperLiveKit live-transcript
                     pipeline. Check Supabase live_transcripts table for rows.

Examples:
  python scripts/test_audio_stream.py
  python scripts/test_audio_stream.py stream
  python scripts/test_audio_stream.py live
  python scripts/test_audio_stream.py live --duration 60
  python scripts/test_audio_stream.py stream scripts/audio-test.mp3
        """
    )
    parser.add_argument(
        "mode",
        nargs="?",
        default="stream",
        choices=["stream", "live"],
        help="Test mode (default: stream)"
    )
    parser.add_argument(
        "audio_file",
        nargs="?",
        default=DEFAULT_MUSIC_PATH,
        help="Path to audio file (default: scripts/audio-test.mp3)"
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=30,
        help="Seconds to stream in 'live' mode before sending RECORD_STOP (default: 30)"
    )

    args = parser.parse_args()
    music_path = args.audio_file

    try:
        async with websockets.connect(WS_URI) as websocket:
            print(f"Connected to ClassMonitor audio server on {WS_URI}")

            if args.mode == "live":
                await stream_with_live_transcription(websocket, music_path, args.duration)
            else:
                # Default: continuous stream (original behaviour)
                if os.path.exists(music_path):
                    await stream_music_file(websocket, music_path)
                else:
                    print(f"No audio file found at: {music_path}")
                    print("Falling back to simulated tone...")
                    await stream_tone(websocket)

    except ConnectionRefusedError:
        print(f"Error: Could not connect to the server. Is it running on {WS_URI}?")
        print("Start it with: python servers/audio-server/server.py")
    except websockets.exceptions.ConnectionClosed:
        print("WebSocket connection was closed by the server.")
    except KeyboardInterrupt:
        print("\nStreaming stopped by user.")

if __name__ == "__main__":
    asyncio.run(main())
