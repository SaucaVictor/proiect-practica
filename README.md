# ClassMonitor 🖥️🔊

**ClassMonitor** transformă o sală de curs clasică într-un ecosistem inteligent: monitorizare IoT în timp real, conferință audio WebRTC live, **transcriere automată a cursurilor în timp real (Speech-to-Text)** și un chat AI bazat pe RAG care permite studenților să interogheze conținutul cursurilor.

---

## 🧩 Arhitectura Sistemului

```
ESP32 (INMP441 mic)
  │
  │  WebSocket — raw PCM 16kHz mono s16le
  ▼
audio-server :8001          ← Serverul audio local
  ├── WebRTC broadcast      → Browser (Live Audio)
  ├── WAV recording buffer  → Supabase Storage (după stop)
  └── WLK relay             → whisperlivekit :8000/asr
                                  │
                             Transcript JSON
                                  │
                             Supabase: live_transcripts ← Realtime → Browser (Live Transcript)

mqtt-server                 ← Bridge MQTT ↔ Supabase (senzori IoT)

Frontend (Vue 3 + Vite)     ← Supabase Auth, Realtime, Storage, REST
```

---

## 🚀 Funcționalități

| Funcționalitate | Stare |
|---|---|
| Conferință Audio Live (WebRTC) | ✅ |
| **Transcriere Live în Timp Real (WhisperLiveKit)** | ✅ **Nou** |
| Transcriere Batch după înregistrare | ✅ |
| Upload audio + transcript în Supabase Storage | ✅ |
| Monitoring senzori IoT (DHT11, LDR, ACS712) | ✅ |
| Control actuatori (LED, ventilator, PTC) | ✅ |
| Chat AI cu RAG pe transcripturi | ✅ |

---

## 🛠️ Instalare & Prerechizite

Înainte de a rula proiectul, trebuie să instalezi dependențele pentru frontend și pentru servere, și să configurezi variabilele de mediu.

### 1. Dependențe Frontend (Node.js)
Instalează modulele NodeJS din rădăcina proiectului:
```bash
npm install
```

### 2. Variabile de Mediu
Copiază fișierul `.env.example` în `.env` și completează credențialele tale de Supabase, API keys, etc.:
```bash
cp .env.example .env
```

### 3. Dependențe Python (Servere & Scripturi de Test)
Instalează pachetele de Python pentru serverul audio, serverul MQTT și testarea simulărilor:
```bash
pip install -r servers/audio-server/requirements.txt
```

---

## 🚀 Pornirea Serverelor

Poți rula separat componentele aplicației din rădăcina proiectului utilizând comenzile de mai jos:

### 1. Serverul Audio — WebRTC + Deepgram ASR _(port 8001)_
- **Pornire Standard** (așteaptă explicit semnalul `RECORD_START` pentru a activa conexiunea de transcriere):
  ```bash
  npm run audio-server
  ```
- **Pornire cu Auto-Transcriere** (transcrierea live pornește instant la prima conectare a microfonului):
  ```bash
  npm run audio-server:auto
  ```

### 2. Serverul MQTT (Bridge Senzori/Actuatori IoT)
Pornește bridge-ul MQTT către baza de date Supabase:
```bash
npx tsx servers/mqtt-server/server.ts
```

### 3. Pornire Rapidă (Audio-Server + MQTT-Server deodată)
Pornește simultan Audio-Server și MQTT-Server în mod paralel:
```bash
npm run servers
```

### 4. Frontend Vue 3 (Aplicația Web de client)
Pornește serverul local de development pentru frontend:
```bash
npm run dev
```

---

## 🗄️ Migrări Supabase

Aplică migrările în ordine în **Supabase SQL Editor** (`supabase/migrations/`):

| Fișier | Conținut |
|---|---|
| `001_initial_schema.sql` | Tabele de bază (profiles, conversations, messages) |
| `002_rls_policies.sql` | Politici RLS |
| `003_schedule.sql` | Orar săptămânal (materii și intervale orare) |
| `004_webrtc_signaling.sql` | Semnalizare WebRTC |
| `005_storage_courses.sql` | Bucket Supabase Storage `courses` |
| `006_update_default_model.sql` | Model LLM implicit |
| `007_user_resources.sql` | Resurse utilizator |
| `008_settings_open_resources.sql` | Setări deschise |
| **`009_live_transcripts.sql`** | **Segmente transcriere live (nou)** |

---

## 🧪 Testare Manuală (Fără Hardware ESP32)

Poți simula comportamentul microfonului fizic (ESP32) streamuind fișierul audio de probă **`scripts/audio-test.mp3`** către servere.

### A. Test Streaming Live (WebRTC Audio)
Simulează microfonul ESP32 trimițând fluxul audio în buclă:
```bash
# Rulare implicită stream
npm run test-audio

# Rulare explicită modul stream
npm run test-audio -- stream

# Rulare cu un fișier audio custom
npm run test-audio -- stream /cale/catre/fisier.mp3
```
*Ghid de utilizare:*
1. Pornește serverul audio: `npm run audio-server`
2. Rulează comanda de test-audio de mai sus.
3. Deschide site-ul → accesează **Live Audio** → click pe **Conectare la Curs** pentru a auzi audio în browser în timp real.

### B. Test Transcriere Live (Deepgram/WLK) ⭐ Nou
Simulează o sesiune activă de curs cu înregistrare și transcriere live:
```bash
# Rulare standard (30 de secunde)
npm run test-audio -- live

# Durată specifică (ex. 60 de secunde)
python scripts/test_audio_stream.py live scripts/audio-test.mp3 --duration 60
```
*Ce face:*
1. Trimite comanda `RECORD_START` → audio-server-ul deschide conexiunea cu serviciul de transcriere.
2. Transmite audio PCM în timp real, iar transcrierea apare în tabelele `live_transcripts` din Supabase.
3. Panoul **Transcriere Live** din frontend afișează textul în timp real cu latență minimă.
4. La finalul duratei trimite `RECORD_STOP`, salvează fișierul WAV și finalizează transcrierea.

### C. Test Flow Înregistrare + Upload + Transcriere Batch
Testarea automată a fluxului de înregistrare locală, upload în Supabase Storage și transcriere post-înregistrare:
```bash
# 1. Pornește serverele de bază
npm run servers

# 2. Pornește stream-ul de simulare
python scripts/test_audio_stream.py stream

# 3. Declanșează înregistrarea (durată fixă de 30s)
python scripts/test_recording_flow.py
```

### D. Test Transcriere Batch Directă
Efectuează o transcriere batch rapidă a fișierului de test local către REST API:
```bash
python scripts/test_transcribe_flow.py
```

---

## ⚙️ Variabile de Mediu (`.env`)

```env
# Supabase
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# AI Chat (NVIDIA NIM)
VITE_NVIDIA_API_KEY=nvapi-...

# Hugging Face (transcriere cloud, opțional)
VITE_HF_TOKEN=hf_...

# Deepgram (transcriere live & batch cloud)
DEEPGRAM=your_deepgram_api_key_here
```

> Copiază `.env.example` → `.env` și completează valorile tale.

---

## 📁 Structura Proiectului

```
├── src/                        # Frontend Vue 3
│   ├── pages/AudioCallPage.vue # Conferință audio + panou transcriere live
│   ├── composables/
│   │   ├── useAudioCall.ts     # WebRTC client
│   │   └── useLiveTranscript.ts# Supabase Realtime → segmente live
│   └── ...
├── servers/
│   ├── audio-server/           # FastAPI: WebRTC + Deepgram ASR (port 8001)
│   │   ├── server.py
│   │   └── requirements.txt
│   └── mqtt-server/            # Bridge MQTT ↔ Supabase
├── scripts/
│   ├── test_audio_stream.py    # Test streaming + live transcription
│   ├── test_recording_flow.py  # Test înregistrare + batch upload
│   ├── test_transcribe_flow.py # Test transcriere directă
│   └── audio-test.mp3          # Fișier audio de test
├── supabase/migrations/        # Migrări SQL Supabase
└── docs/product_brief.md       # Document de produs complet
```
## 🌐 Setup Tunneling Public (ngrok)

Pentru a permite unei versiuni de frontend deployate public (de exemplu pe Vercel) să comunice securizat cu serverul tău audio local (`audio-server` pe portul 8001), urmează acești pași de configurare:

### 1. Instalare locală ngrok
Instalează clientul ngrok local în proiect ca devDependency (pentru a evita erorile de PATH pe Windows):
```bash
npm install --save-dev ngrok
```

### 2. Configurare Authtoken (O singură dată)
Autentifică clientul local ngrok folosind token-ul tău gratuit obținut de pe [ngrok Dashboard](https://dashboard.ngrok.com/):
```bash
npx ngrok config add-authtoken <YOUR_AUTHTOKEN>
```

### 3. Pornirea Tunnelului Static
Rulați comanda preconfigurată din `package.json` care pornește proxy-ul ngrok pe portul 8001 cu domeniul tău static rezervat:
```bash
npm run tunnel
```

---

DEPLOY TRIGGER = 4

