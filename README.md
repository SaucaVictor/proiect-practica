# ClassMonitor 🖥️🔊

ClassMonitor este o aplicație web premium concepută pentru monitorizarea energetică și controlul bidirecțional al sălilor de curs (IoT), dotată cu interfață AI multimodală avansată. 

Acest depozit conține codul sursă pentru interfața web (Vue 3, Vite, TailwindCSS) și pipeline-ul de Speech-to-Text (ASR).

---

## 🚀 Funcționalități Multimodale AI
* **Transcriere Audio Automată (ASR)**: Încarcă fișiere audio în chat pentru a fi transcrise automat și trimise ca text/context către LLM.
* **Switch Flexibil (Local / Cloud)**: O opțiune direct în bara de chat permite selectarea instantanee a sursei de transcriere:
  * **ASR Cloud**: Folosește API-ul Hugging Face Serverless (Whisper Large v3) gratuit.
  * **ASR Local**: Rulează un server local de Whisper în Python pe mașina ta pentru transcrieri complet offline, rapide și de dimensiuni nelimitate.

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

## 🎙️ Ghid de Pornire și Rulare (ASR Local)

Pentru a folosi transcrierea locală în loc de serviciul cloud, poți rula serverul integrat FastAPI din folderul `speech-to-text`.

### 1. Instalare Dependențe Python
Deschide un terminal în root-ul proiectului și rulează:
```bash
pip install faster-whisper fastapi uvicorn python-multipart
```

*Notă: `faster-whisper` este o implementare reimplementată și optimizată a modelului Whisper de la OpenAI, fiind de până la 4 ori mai rapidă și consumând mult mai puțină memorie.*

### 2. Pornire Server Local
Rulează scriptul de pornire din folderul `speech-to-text`:
```bash
python speech-to-text/server.py
```
Serverul va fi pornit automat pe `http://localhost:8000`.

### 3. Utilizare în Interfață
1. Deschide aplicația web în browser.
2. În bara de mesaje (Chat Input), dă click pe butonul **ASR: Cloud** pentru a-l schimba în **ASR: Local**.
3. Atașează orice fișier audio și trimite mesajul — transcrierea se va efectua acum complet local pe calculatorul tău!

---

## ⚙️ Variabile de Mediu (.env)
Aplicația folosește următoarele variabile cheie pentru controlul ASR:
* `VITE_HF_TOKEN`: Token Hugging Face pentru API-ul cloud.
* `VITE_ASR_ENDPOINT`: URL-ul către serverul local de transcriere (implicit `http://localhost:8000/transcribe`).
