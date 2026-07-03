# ClassMonitor 🖥️🔊

ClassMonitor este o aplicație web premium concepută pentru monitorizarea energetică și controlul bidirecțional al sălilor de curs (IoT), dotată cu interfață AI multimodală avansată.

Acest depozit conține codul sursă pentru interfața web (Vue 3, Vite, TailwindCSS) și pipeline-ul de Speech-to-Text (ASR).

---

## 🚀 Funcționalități Multimodale AI

- **Transcriere Audio Automată (ASR)**: Încarcă fișiere audio în chat pentru a fi transcrise automat și trimise ca text/context către LLM.
- **Switch Flexibil (Local / Cloud)**: O opțiune direct în bara de chat permite selectarea instantanee a sursei de transcriere:
  - **ASR Cloud**: Folosește API-ul Hugging Face Serverless (Whisper Large v3) gratuit.
  - **ASR Local**: Rulează un server local de Whisper în Python pe mașina ta pentru transcrieri complet offline, rapide și de dimensiuni nelimitate.

---

## 🛠️ Ghid de Instalare și Rulare (Frontend)

1. **Instalează dependențele Node.js**:

   ```bash
   npm install
   ```

2. **Configurează fișierul `.env`**:
   Copiază fișierul `.env.example` sub numele `.env` și completează credențialele tale (Supabase, cheia NVIDIA NIM și, opțional, token-ul Hugging Face):

   ```bash
   cp .env.example .env
   ```

3. **Pornește serverul de dezvoltare**:
   ```bash
   npm run dev
   ```

---

## 🎙️ Servere Locale și Ghid de Pornire

Proiectul ClassMonitor folosește servere locale pentru a procesa media în timp real, a rula ASR (Speech-to-Text) offline și a face legătura cu hardware-ul din clasă.

### 1. Serverul Speech-to-Text (ASR) Local (`servers/speech-to-text`)

Acest server FastAPI rulează Whisper pentru a asigura transcrieri locale rapide, offline și de dimensiuni nelimitate, folosite direct în chat-ul AI al site-ului.

### Pornire Rapidă (Ambele Servere)

Dacă rulezi pe Windows, poți porni ambele servere simultan, fiecare în propria fereastră de terminal, folosind comanda:

```bash
npm run servers
```

### Pornire Individuală

Dacă dorești să le pornești manual:

1. **Serverul ASR**:

   ```bash
   python servers/speech-to-text/server.py
   ```

   _(Pornit pe portul `8000` pentru interfața de chat)_

2. **Serverul Audio**:
   ```bash
   python servers/audio-server/server.py
   ```
   _(Pornit pe portul `8001` pentru WebSocket/WebRTC)_

#### Instalare Dependențe Python

Deschide un terminal în root-ul proiectului și instalează bibliotecile necesare:

```bash
pip install faster-whisper fastapi uvicorn python-multipart aiortc av numpy httpx websockets
```

---

### 3. Serverul pentru Senzori & Bridge MQTT (În Curând / Soon)

Acest al treilea server local va gestiona:

- **Preluare Telemetrie**: Ascultă brokerul MQTT public pentru date de la senzorii DHT11, LDR, ACS712 trimiși de Wemos D1 R32 și le salvează în Supabase.
- **Transmitere Comenzi**: Ascultă tabela `iot_settings` din Supabase și trimite în timp real comenzile de control (ventilator, LED, PTC) înapoi pe MQTT către microcontroler.

---

## 🧪 Ghid de Testare Manuală (Fără Hardware)

Pentru a testa fluxurile fără a avea plăcile Wemos D1 ESP32 conectate fizic, poți folosi fișierul audio de test preconfigurat: **`scripts/audio-test.mp3`**.

### A. Testare Streaming Live (WebRTC)

1. Asigură-te că serverul audio rulează pe portul `8001`: `python servers/audio-server/server.py`
2. Porneste stream-ul de test:
   ```bash
   python scripts/test_audio_stream.py
   ```
   _(Acesta va simula microfonul Wemos trimițând fișierul audio-test.mp3 în buclă)._
3. În site, deschide pagina **Live Audio (icoana căști)** din sidebar și apasă **Conectare la Curs**.

### B. Testare Rapidă Transcriere & Încărcare Directă

1. Asigură-te că serverul ASR rulează pe portul `8000`: `python servers/speech-to-text/server.py`
2. Asigură-te că ai creat bucket-ul `courses` în Supabase (vezi migrarea `005_storage_courses.sql`).
3. Pornește scriptul de test:
   ```bash
   python scripts/test_transcribe_flow.py
   ```
   _(Acesta va trimite fișierul audio-test.mp3 la serverul ASR local, îl va transcrie și le va urca pe ambele în bucket-ul Supabase)._

### C. Testare Flow Înregistrare complet în Timp Real

Acesta simulează înregistrarea stream-ului în timp real de pe server, urmată de salvare, ASR și upload:

1. Porneste ambele servere local: `npm run servers` (ASR pe 8000 și Audio pe 8001)
2. Porneste stream-ul de test: `python scripts/test_audio_stream.py` (pentru a simula hardware-ul care trimite sunet live)
3. Rulează scriptul de control:
   ```bash
   python scripts/test_recording_flow.py
   ```
   _(Acesta va trimite comanda de start înregistrare către Audio Server, va înregistra timp de 30 de secunde din stream-ul activ, va opri înregistrarea, o va salva local ca `recording.wav`, o va încărca în storage, o va trimite la serverul ASR pe portul 8000, iar apoi va încărca transcrierea obținută în Supabase)._

---

## ⚙️ Variabile de Mediu (.env)

Aplicația folosește următoarele variabile cheie pentru controlul ASR și bazei de date:

- `VITE_SUPABASE_URL`: URL-ul proiectului tău Supabase.
- `VITE_SUPABASE_ANON_KEY`: Anon key-ul proiectului Supabase (necesar pentru semnalizarea WebRTC).
- `VITE_HF_TOKEN`: Token Hugging Face pentru API-ul cloud (dacă se folosește transcrierea cloud).
- `VITE_ASR_ENDPOINT`: URL-ul către serverul local de transcriere (implicit `http://localhost:8000/transcribe`).

DEPLOY TRIGGER = 2
