# ClassMonitor 🖥️🔊

**ClassMonitor** transformă o sală de curs clasică într-un ecosistem inteligent: monitorizare IoT în timp real, conferință audio WebRTC live, **transcriere automată a cursurilor (Speech-to-Text)** și un chat AI bazat pe RAG care permite studenților să interogheze conținutul cursurilor.

> **Practică — UTCB x DeviDevs, 2026**

---

## 🏗️ Stack Tehnologic

| Layer              | Tehnologii                                         |
| ------------------ | -------------------------------------------------- |
| **Frontend**       | Vue 3 · TypeScript · Tailwind CSS · Vite           |
| **Backend**        | FastAPI (Python) · WebSocket · WebRTC (`aiortc`)   |
| **Bază de Date**   | Supabase (PostgreSQL + RLS + Realtime + Storage)   |
| **IoT / Embedded** | ESP32 (Wemos D1 R32) · Arduino · MQTT              |
| **AI / NLP**       | NVIDIA NIM (LLM) · Deepgram (ASR) · pgvector (RAG) |
| **Infrastructură** | Vercel (frontend) · ngrok (tunnel audio-server)    |

---

## 🧩 Arhitectura Sistemului

```
┌─────────────────────────────────────────────────────────────────────┐
│  ESP32 (Wemos D1 R32)                                              │
│  ├── Senzori: DHT11, LDR, ACS712, IR×2                            │
│  ├── Actuatori: LED strip, Ventilatoare×2, PTC Heater (via MOSFET) │
│  ├── INMP441 Mic → I2S → PCM 16kHz mono s16le                     │
│  └── OLED 0.96" (afișaj local)                                     │
└───────┬────────────────────────┬────────────────────────────────────┘
        │ MQTT (telemetrie)      │ WebSocket (audio PCM)
        ▼                       ▼
┌───────────────┐    ┌──────────────────────────────────────────┐
│  mqtt-server  │    │  audio-server :8001  (FastAPI + aiortc)  │
│  (TS/Node)    │    │  ├── WebRTC broadcast → Browser (audio)  │
│  MQTT ↔ Supa  │    │  ├── WAV buffer → Supabase Storage       │
│               │    │  └── Deepgram WS → live transcript        │
└───────┬───────┘    └──────────────┬───────────────────────────┘
        │                           │
        ▼                           ▼
┌───────────────────────────────────────────────────────────────┐
│  Supabase                                                     │
│  ├── PostgreSQL: profiles, conversations, messages, iot_*     │
│  ├── pgvector: document_chunks (embeddings RAG)               │
│  ├── live_transcripts (Realtime → frontend)                   │
│  ├── Storage: bucket "courses" (WAV + transcript JSON)        │
│  └── Auth (email/password + RLS)                              │
└───────────────────────────────────────────────────────────────┘
        ▲
        │ Supabase JS SDK
        │
┌───────────────────────────────────────────────────────────────┐
│  Frontend (Vue 3 + Vite)                                      │
│  ├── /chat         → AI Chat cu RAG pe transcripturi          │
│  ├── /audio-call   → Conferință audio + transcriere live      │
│  ├── /iot          → Dashboard senzori + control actuatori    │
│  ├── /schedule     → Orar săptămânal                          │
│  ├── /workspace    → Upload resurse (PDF, text)               │
│  └── /settings     → Configurare model LLM, preferințe       │
└───────────────────────────────────────────────────────────────┘
```

---

## 🚀 Funcționalități

| Funcționalitate            | Descriere                                                                       | Stare |
| -------------------------- | ------------------------------------------------------------------------------- | ----- |
| **Conferință Audio Live**  | Stream audio WebRTC de la ESP32/INMP441 direct în browser                       | ✅    |
| **Transcriere Live (STT)** | Deepgram WebSocket → segmente live în Supabase Realtime → afișare instant       | ✅    |
| **Transcriere Batch**      | Upload WAV → Deepgram REST → transcript JSON salvat                             | ✅    |
| **Chat AI cu RAG**         | Întrebări despre conținutul cursurilor; embedding-uri pgvector + NVIDIA NIM LLM | ✅    |
| **Dashboard IoT**          | Vizualizare real-time: temperatură, umiditate, lumină, curent, prezență         | ✅    |
| **Control Actuatori**      | PWM: bandă LED, ventilatoare, PTC heater — cu scenarii automatizare             | ✅    |
| **Workspace Resurse**      | Upload PDF/text → chunking automat → indexare vectorială RAG                    | ✅    |
| **Orar Săptămânal**        | Configurare materii și intervale orare pe săptămână                             | ✅    |
| **Autentificare**          | Supabase Auth (email/parolă) cu RLS pe toate tabelele                           | ✅    |

---

## 🤖 Cum Funcționează Chat-ul AI (RAG)

Sistemul **Retrieval-Augmented Generation** permite studenților să pună întrebări despre cursurile transcrise:

1. **Indexare** — Transcrierile live și resursele uploadate sunt fragmentate în chunk-uri și convertite în embeddings vectoriale (NVIDIA NIM) stocate în `document_chunks` (pgvector).
2. **Căutare Semantică** — La fiecare întrebare, query-ul este transformat în embedding și comparat cosinus cu chunk-urile existente.
3. **Generare Răspuns** — Chunk-urile cele mai relevante sunt injectate ca context XML în system prompt-ul LLM-ului (NVIDIA NIM), care generează un răspuns fundamentat pe conținutul real al cursurilor.

---

## 🔌 Componentă Hardware

Proiectul include o machetă fizică completă bazată pe **ESP32 (Wemos D1 R32)**. Documentația detaliată se găsește în directorul [`hardware/`](hardware/):

- **[BOM (Bill of Materials)](hardware/BOM.md)** — Lista completă de componente cu specificații
- **[Schemă Fritzing](hardware/schematic.fzz)** — Schema electrică editabilă
- **Firmware** — Două versiuni: de bază (MQTT telemetrie) și finală (MQTT + Audio I2S)
- **Test Sketches** — Cod Arduino individual pentru testarea fiecărei componente

### Componente Principale

| Categorie          | Componente                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **Microcontroler** | Wemos D1 R32 (ESP32), WiFi/BT integrat                                                         |
| **Senzori**        | DHT11 (temp/umiditate), LDR (lumină), ACS712 (curent), IR×2 (prezență), INMP441 (microfon I2S) |
| **Actuatori**      | Bandă LED 12V, Ventilatoare DC×2, PTC Heater — toate prin MOSFET IR540N                        |
| **Afișaj**         | OLED 0.96" I2C                                                                                 |
| **Alimentare**     | Sursă 12V DC + regulator step-down 5V/3.3V                                                     |

---

## 📋 Prerechizite

Înainte de a rula proiectul, asigură-te că ai instalate:

| Cerință     | Versiune Minimă | Utilizare                              |
| ----------- | --------------- | -------------------------------------- |
| **Node.js** | ≥ 18            | Frontend Vue 3 + servere TS            |
| **Python**  | ≥ 3.10          | Audio-server (FastAPI), scripturi test |
| **pip**     | —               | Dependențe Python                      |
| **ffmpeg**  | —               | Conversie audio (test scripts)         |
| **Git**     | —               | Clonare proiect                        |

---

## 🛠️ Instalare

### 1. Clonare Proiect

```bash
git clone https://github.com/SaucaVictor/proiect-practica.git
cd proiect-practica
```

### 2. Variabile de Mediu

Copiază fișierul `.env.example` în `.env` și completează credențialele:

```bash
cp .env.example .env
```

### 3. Dependențe Frontend (Node.js)

```bash
npm install
```

### 4. Dependențe Python (Audio Server)

```bash
pip install -r servers/audio-server/requirements.txt
```

---

## ⚙️ Variabile de Mediu (`.env`)

Consultă [`.env.example`](.env.example) pentru template-ul complet. Variabilele principale:

```env
# ─── Supabase ────────────────────────────────────────────────────
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# ─── NVIDIA NIM (LLM pentru Chat AI) ────────────────────────────
VITE_NVIDIA_API_KEY=nvapi-...

# ─── Deepgram (Transcriere live & batch) ─────────────────────────
DEEPGRAM=your_deepgram_api_key_here

# ─── Hugging Face (ASR alternativ, opțional) ────────────────────
VITE_HF_TOKEN=hf_...

# ─── App ─────────────────────────────────────────────────────────
VITE_APP_NAME=ClassMonitor
VITE_APP_URL=http://localhost:5173

# ─── ASR Endpoint (ngrok tunnel, opțional) ───────────────────────
VITE_ASR_ENDPOINT=https://your-domain.ngrok-free.dev/transcribe
```

---

## 🚀 Pornirea Aplicației

### 1. Frontend (Vue 3 + Vite) — port 5173

```bash
npm run dev
```

### 2. Audio Server (FastAPI + WebRTC + Deepgram) — port 8001

```bash
# Standard — așteaptă semnalul RECORD_START pentru transcriere
npm run audio-server

# Cu auto-transcriere — pornește transcrierea instant la prima conectare
npm run audio-server:auto
```

### 3. MQTT Server (Bridge Senzori/Actuatori ↔ Supabase)

```bash
npx tsx servers/mqtt-server/server.ts
```

### 4. Pornire Rapidă (Audio + MQTT simultan)

```bash
npm run servers
```

---

## 🗄️ Migrări Supabase

Aplică migrările în ordine în **Supabase SQL Editor** din directorul [`supabase/migrations/`](supabase/migrations/):

| Fișier                            | Conținut                                            |
| --------------------------------- | --------------------------------------------------- |
| `001_initial_schema.sql`          | Tabele de bază: profiles, conversations, messages   |
| `002_rls_policies.sql`            | Politici Row Level Security                         |
| `003_iot_schema.sql`              | Tabele senzori, dispozitive, setări și scenarii IoT |
| `003_schedule.sql`                | Orar săptămânal (materii, intervale orare)          |
| `004_webrtc_signaling.sql`        | Semnalizare WebRTC                                  |
| `005_storage_courses.sql`         | Bucket Supabase Storage `courses`                   |
| `006_update_default_model.sql`    | Model LLM implicit                                  |
| `007_user_resources.sql`          | Resurse utilizator                                  |
| `008_settings_open_resources.sql` | Setări deschise resurse                             |
| `009_live_transcripts.sql`        | Segmente transcriere live                           |
| `010_rag_second_brain.sql`        | pgvector, document_chunks, căutare semantică        |
| `011_autotranscribe_rag.sql`      | Indexare automată RAG pentru transcrieri live       |

---

## 🧪 Testare (Fără Hardware ESP32)

Poți simula comportamentul microfonului fizic ESP32 folosind fișierul audio de probă `scripts/audio-test.mp3`.

### A. Test Streaming Audio Live (WebRTC)

Simulează microfonul ESP32 trimițând flux audio în buclă:

```bash
# Stream implicit
npm run test-audio

# Stream cu fișier custom
npm run test-audio -- stream /cale/catre/fisier.mp3
```

**Pași:**

1. Pornește `npm run audio-server`
2. Rulează comanda de test-audio
3. Deschide site-ul → **Live Audio** → **Conectare la Curs** → audio în browser

### B. Test Transcriere Live (Deepgram STT)

Simulează o sesiune de curs cu înregistrare + transcriere live:

```bash
# Sesiune standard (30 secunde)
npm run test-audio -- live

# Durată personalizată
python scripts/test_audio_stream.py live scripts/audio-test.mp3 --duration 60
```

**Ce se întâmplă:**

1. Trimite `RECORD_START` → audio-server deschide conexiunea Deepgram
2. Audio PCM este transmis în timp real, transcrierea apare în `live_transcripts`
3. Panoul **Transcriere Live** din frontend afișează textul cu latență minimă
4. La final: `RECORD_STOP` → salvare WAV + finalizare transcript

### C. Test Înregistrare + Upload + Transcriere Batch

```bash
# 1. Pornește serverele
npm run servers

# 2. Pornește stream-ul de simulare
python scripts/test_audio_stream.py stream

# 3. Declanșează înregistrarea (30s)
python scripts/test_recording_flow.py
```

### D. Transcriere Batch Directă

```bash
python scripts/test_transcribe_flow.py
```

---

## 🌐 Deploy

### Frontend — Vercel

Frontend-ul este configurat pentru deploy pe **Vercel** cu rewrite-uri pentru proxy NVIDIA NIM API:

```bash
# Build producție
npm run build

# Preview local
npm run preview
```

Configurare în [`vercel.json`](vercel.json) — include rewrite `/v1/*` → `integrate.api.nvidia.com` pentru a evita expunerea API key-ului client-side.

### Audio Server — ngrok Tunnel

Pentru a expune audio-server-ul local către frontend-ul pe Vercel:

```bash
# Instalare ngrok (o singură dată)
npm install --save-dev ngrok

# Configurare auth token
npx ngrok config add-authtoken <YOUR_AUTHTOKEN>

# Pornire tunnel pe port 8001
npm run tunnel
```

---

## 📁 Structura Proiectului

```
proiect-practica/
├── src/                            # Frontend Vue 3 + TypeScript
│   ├── pages/
│   │   ├── ChatPage.vue            # Chat AI cu RAG
│   │   ├── AudioCallPage.vue       # Conferință audio + transcriere live
│   │   ├── IoTPage.vue             # Dashboard senzori + control actuatori
│   │   ├── SchedulePage.vue        # Orar săptămânal
│   │   ├── WorkspacePage.vue       # Upload și gestiune resurse
│   │   ├── SettingsPage.vue        # Configurare model LLM
│   │   ├── ProfilePage.vue         # Profil utilizator
│   │   ├── LoginPage.vue           # Autentificare
│   │   ├── RegisterPage.vue        # Înregistrare cont
│   │   └── ForgotPasswordPage.vue  # Recuperare parolă
│   ├── composables/
│   │   ├── useChat.ts              # Logică chat + integrare RAG
│   │   ├── useAudioCall.ts         # Client WebRTC
│   │   ├── useLiveTranscript.ts    # Supabase Realtime → transcriere
│   │   ├── useRag.ts              # Căutare semantică + context XML
│   │   └── ...                     # useToast, useClipboard, etc.
│   ├── services/
│   │   ├── ai/                     # ChatService, embeddings, modele LLM
│   │   └── supabase/               # Client, auth, vectorStore, courses...
│   ├── iot-interface/              # Componente + composables IoT
│   ├── stores/                     # Pinia stores
│   ├── router/                     # Vue Router + guards autentificare
│   ├── styles/                     # Stiluri globale
│   └── types/                      # TypeScript interfaces
│
├── servers/
│   ├── audio-server/               # FastAPI: WebRTC + Deepgram ASR (port 8001)
│   │   ├── server.py               # ~960 linii — server principal
│   │   └── requirements.txt
│   └── mqtt-server/                # Bridge MQTT ↔ Supabase (TypeScript)
│
├── hardware/                       # Documentație + firmware ESP32
│   ├── BOM.md                      # Bill of Materials
│   ├── schematic.fzz               # Schemă Fritzing
│   ├── schematic_preview.png       # Preview schemă electrică
│   ├── classmonitor_firmware/      # Firmware de bază (MQTT)
│   ├── classmonitor_firmware_final/# Firmware final (MQTT + Audio I2S)
│   └── test-sketches/              # Teste individuale componente
│
├── scripts/                        # Scripturi de test și utilități
│   ├── test_audio_stream.py        # Test streaming + live transcription
│   ├── test_recording_flow.py      # Test înregistrare + batch upload
│   ├── test_transcribe_flow.py     # Test transcriere directă
│   └── audio-test.mp3              # Fișier audio de probă
│
├── supabase/migrations/            # Migrări SQL (001–011)
├── docs/product_brief.md           # Document de produs
├── vercel.json                     # Configurare deploy Vercel
├── .env.example                    # Template variabile de mediu
└── package.json                    # Scripts npm + dependențe
```

---

## 👥 Echipă

| Membru                   | Rol                                                |
| ------------------------ | -------------------------------------------------- |
| **Săuca Victor**         | Full-stack development, AI/RAG, arhitectură sistem |
| **Tuțu Cristian**        | Hardware, embedded, firmware ESP32                 |
| **Bucura Ion-Bogdan**    | Hardware, electronică de putere, testare senzori   |
| **Vîrnav Ștefan-Adrian** | Arhitectură sistem,UI                              |
---

## 📄 Licență

Proiect realizat în cadrul practicii universitare — **UTCB x DeviDevs, 2026**.
