import os
import sys
import math
import time
import asyncio
import numpy as np
import websockets
import av

# Path to the shared test audio file relative to the script location
DEFAULT_MUSIC_PATH = os.path.join(os.path.dirname(__file__), "audio-test.mp3")
WS_URI = "ws://127.0.0.1:8001/ws/audio"

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

async def main():
    # Use path from argument if provided, otherwise default
    music_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MUSIC_PATH
    
    try:
        async with websockets.connect(WS_URI) as websocket:
            print(f"Connected to ClassMonitor audio server on {WS_URI}")
            if os.path.exists(music_path):
                await stream_music_file(websocket, music_path)
            else:
                print(f"No audio file found at: {music_path}")
                print("Falling back to simulated tone...")
                await stream_tone(websocket)
                
    except ConnectionRefusedError:
        print("Error: Could not connect to the server. Is it running on ws://127.0.0.1:8001?")
    except websockets.exceptions.ConnectionClosed:
        print("WebSocket connection was closed by the server.")
    except KeyboardInterrupt:
        print("\nStreaming stopped by user.")

if __name__ == "__main__":
    asyncio.run(main())
