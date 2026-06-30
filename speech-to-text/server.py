import os
import sys
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Local ASR Server for ClassMonitor")

# Enable CORS for frontend compatibility (default Vue port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variables
model = None
model_type = None

# Initialize model
try:
    print("Loading local ASR model (faster-whisper)...")
    from faster_whisper import WhisperModel
    # Using 'base' model for a good balance of speed, memory, and accuracy.
    # Runs on CPU by default. Set device='cuda' if you have an NVIDIA GPU.
    model = WhisperModel("base", device="cpu", compute_type="int8")
    model_type = "faster-whisper"
    print("Loaded faster-whisper successfully!")
except ImportError:
    try:
        print("faster-whisper not found, falling back to openai-whisper...")
        import whisper
        model = whisper.load_model("base")
        model_type = "openai-whisper"
        print("Loaded openai-whisper successfully!")
    except ImportError:
        print("\n" + "="*80)
        print("WARNING: Neither 'faster-whisper' nor 'openai-whisper' python libraries are installed.")
        print("Please install them to run local transcription:")
        print("   pip install faster-whisper fastapi uvicorn python-multipart")
        print("="*80 + "\n")

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(
            status_code=500,
            detail="ASR Model is not loaded. Please install dependencies: pip install faster-whisper fastapi uvicorn python-multipart"
        )
    
    # Save the file temporarily to disk for processing
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as f:
        f.write(await file.read())
        
    try:
        text = ""
        if model_type == "faster-whisper":
            segments, info = model.transcribe(temp_filename, beam_size=5)
            text = " ".join([seg.text for seg in segments])
        elif model_type == "openai-whisper":
            result = model.transcribe(temp_filename)
            text = result["text"]
            
        return {"text": text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

if __name__ == "__main__":
    import uvicorn
    # Start the server on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
