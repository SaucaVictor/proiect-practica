# Product Brief — ClassMonitor

**Proiect:** ClassMonitor — Sistem Inteligent de Monitorizare a Sălii și Transcriere Automatizată a Cursurilor  
**Status:** Draft / În Evaluare  
**Data:** 2026-06-30  
**Echipa:** Saucă Victor (Lead/Web), Tuțu Cristian (Hardware/Embedded), Bucura Ion-Bogdan (Hardware/Integrări), Trocea David (Frontend), Tudor Constantin (QA/Docs), Vîrnav Ștefan (MLOps/Infra)

---

## 1. Viziunea și Obiectivul Produsului

**ClassMonitor** transformă o sală de curs clasică într-un ecosistem inteligent, automatizat și multimodal. Proiectul rezolvă două probleme majore din mediul academic:
1. **Managementul ambiental și energetic eficient:** Monitorizarea continuă a parametrilor fizici ai sălii (temperatură, curent, lumină, prezență) și controlul bidirecțional automatizat/manual al actuatorilor (încălzire, ventilatoare, iluminat).
2. **Accesibilizarea și digitalizarea cursurilor:** Transmiterea audio live a cursurilor (Meet-style) pentru studenții de la distanță și stocarea/transcrierea automată (Speech-to-Text local) a acestora. Informațiile sunt ulterior indexate într-o interfață de chat AI, unde studenții pot interoga un agent antrenat pe conținutul cursurilor și documentelor PDF atașate.

---

## 2. Arhitectura și Componentele Sistemului

Sistemul este împărțit în patru mari componente: **Hardware (Edge)**, **Cele Două Servere Locale**, **Platforma Cloud (Supabase)** și **Aplicația Web (Site-ul)**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                SALA DE CURS                                 │
│                      Wemos D1 R32 (ESP32 microcontroler)                    │
│      │ MQTT (Date senzori)                               ▲ MQTT (Comenzi)   │
│      │                                                   │                  │
├──────┼───────────────────────────────────────────────────┼──────────────────┤
│      │                                                   │                  │
│      ▼ [MQTT Broker]                                     │                  │
│  ┌──────────────────────────────┐                        │                  │
│  │   1. SERVER PENTRU SENZORI   ├────────────────────────┘                  │
│  │       (Node.js Bridge)       │                                           │
│  └──────────────┬───────────────┘                                           │
│                 │                                                           │
│                 │ Citește / Scrie date & comenzi live                       │
│                 ▼                                                           │
│  ┌──────────────────────────────┐                                           │
│  │      SUPABASE CLOUD          │◄────────────────────────┐                 │
│  │      (Bază de date           │                         │ Urcă înregistrări│
│  │        & Storage)            │                         │ și transcripturi │
│  └──────────────▲───────────────┘                         │                 │
│                 │                                         │                 │
│                 │ Citește date                            │                 │
│                 │ Scrie comenzi                           │                 │
│                 ▼                                         │                 │
│  ┌──────────────────────────────┐                 ┌───────┴────────┐        │
│  │        APLICAȚIA WEB         │                 │   2. SERVER    │        │
│  │         (Vue/Vite)           │◄────────────────┤     AUDIO      │◄───────┘
│  └──────────────────────────────┘  Stream WebRTC  │ (Local PC/ASR) │ WebSocket Audio
│                                    (Audio Live)   └────────────────┘ (Continuu)
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Cele Două Servere Locale (Funcționare detaliată)

#### 1. Serverul pentru Senzori (MQTT Bridge)
*   **Intrări:** Primește prin MQTT datele brute de la senzori (DHT11, LDR, ACS712, IR1, IR2) trimiși de Wemos D1 R32.
*   **Transmisie Cloud:** Împinge aceste date direct în Supabase, de unde sunt încărcate live de interfața web (partea de senzori).
*   **Bucla de Control:** Serverul ascultă în timp real schimbările de comenzi scrise din interfața web în Supabase și le retransmite prin MQTT către Wemos D1 R32 pentru a comanda actuatorii.

#### 2. Serverul Audio (WebSocket, Streaming & Transcriere)
*   **WebSocket Receive:** Primește în mod continuu (în timpul orelor din orar) fluxul audio brut de la microfonul INMP441 conectat la Wemos D1.
*   **Procesul A: Streaming Live (WebRTC):** În paralel cu înregistrarea, serverul preia fluxul WebSocket și îl transmite direct către site sub formă de apel audio WebRTC (similar cu Google Meet dar doar audio), permițând studenților conectați remote să asculte cursul live.
*   **Procesul B: Înregistrare & Transcriere locală:**
    *   Când profesorul apasă butonul fizic (sau comanda din interfață), serverul începe să scrie/salveze audio local.
    *   La a doua apăsare a butonului (oprire înregistrare):
        1.  Înregistrarea se oprește, iar fișierul audio `.wav`/`.mp3` este **încărcat imediat** în Supabase Storage.
        2.  Pornește automat pipeline-ul de transcriere local (folosind `faster-whisper`, `fastapi`, `uvicorn`, `python-multipart`).
        3.  Când pipeline-ul de transcriere se termină, textul rezultat este urcat direct în tabelul corespunzător din Supabase.

---

### 2.2. Structura și Funcționalitățile Interfeței Web

Aplicația web oferă un portal securizat împărțit în patru secțiuni logice:

#### 1. Controlul Senzorilor (Doar Admin / Profesor)
*   Vizualizare grafice în timp real cu istoricul senzorilor (temperatură, umiditate, intensitate luminoasă, prezență, consum curent).
*   Transmitere comenzi manuale către actuatori (ventilatoare, bandă LED, încălzire PTC).
*   Configurare reguli și scenarii automate de funcționare (ex: *"Dacă consumul pe ACS712 depășește X wați sau este ora 20:00, stinge toate echipamentele"*).

#### 2. Organizare Cursuri și Materiale (Doar Profesor / Admin)
*   **Management Orar:** Definirea materiilor în funcție de intervalele orare ale zilei.
*   **Gestiune Context:** Profesorii pot încărca fișiere suport (PDF) asociate unei materii. Încărcarea se face introducând o dată calendaristică validă, care creează automat structura logică în Supabase (`/NumeMaterie/DatăCurs/`).
*   **Manager Inregistrări:** Vizualizarea fișierelor audio și a transcripturilor salvate automat în folderul cursului corespunzător.

#### 3. Conferință Audio Live (Orice Utilizator - Student / Profesor)
*   Secțiune WebRTC de tip "audio-only call" unde studenții pot intra oricând pe durata orelor din orar pentru a asculta cursul în direct.

#### 4. Chat Interactiv AI (Orice Utilizator - Student / Profesor)
*   Interfață de dialog AI unde utilizatorii pot selecta modelul LLM dorit.
*   Interogările folosesc tehnica RAG (Retrieval-Augmented Generation) pe baza fișierelor încărcate ca context (atât PDF-urile încărcate de profesor, cât și transcripturile ASR generate automat în urma înregistrării orelor). AI-ul oferă răspunsuri personalizate, devenind un tutore expert în materia selectată.

---

## 3. Logica de Funcționare a Înregistrării și Orarului

1.  **Fluxul continuu:** Serverul audio transmite fluxul primit de la Wemos în apelul WebRTC de pe site pe tot parcursul orelor active din orar.
2.  **Ciclul Înregistrării:**
    *   *Start:* Profesorul apasă butonul (fizic sau web). Macheta se aprinde (LED indicator). Serverul audio începe salvarea streamului pe disc.
    *   *Stop:* Profesorul apasă din nou butonul. LED-ul se stinge.
    *   *Upload Audio:* Serverul oprește imediat salvarea și încarcă fișierul audio pe Supabase în calea determinată de orar (`/Materie/Dată/audio.mp3`).
    *   *Transcriere locală:* Serverul rulează ASR-ul pe fișierul local.
    *   *Upload Text:* La terminarea transcrierii, fișierul text/transcriptul este urcat în Supabase în aceeași locație (`/Materie/Dată/transcript.txt`) pentru a fi utilizat în chat-ul AI.

---

## 4. Ce e Dificil (Riscuri Tehnice și Atenuări)

| Risc Tehnic | Impact | Strategie de Atenuare |
|---|---|---|
| **Latență și stabilitate WebRTC / Websockets** | Mare | Serverul local audio va folosi buffering mic; în caz de deconectare WebSocket de la Wemos, se încearcă reconectarea rapidă fără a opri stream-ul WebRTC extern. |
| **Încărcarea CPU/GPU la transcriere locală** | Mediu | `faster-whisper` va rula cu model quantizat (ex: `small` sau `medium` în format `int8` sau `float16` pe GPU, sau `tiny` dacă se rulează exclusiv pe CPU) pentru a limita timpul de procesare sub 50% din durata înregistrării. |
| **Managementul datelor din orar (Sincronizare)** | Mediu | Folderul de destinație al înregistrării este mapat strict pe ID-ul cursului activ în baza de date în momentul începerii înregistrării. |
| **Alimentarea la 12V și zgomotul electric** | Mare | Motoarele/ventilatoarele pot introduce zgomot pe linia analogică (LDR / ACS712). Se vor folosi condensatori de decuplare pe alimentarea Wemos și optocuploare/rezistențe adecvate pentru izolarea MOSFET-ului. |

---

## 5. Scope Lock (Ce NU facem în MVP-ul de 2 Săptămâni)

❌ Transmitere video (doar audio live)  
❌ Rulare LLM local pe server (folosim API Cloud Supabase/NVIDIA NIM pentru chat AI)  
❌ Sistem de plată sau gestiune note  
❌ Aplicație nativă de mobil (interfața web va fi responsive PWA)  
❌ Autentificare avansată multi-factor (auth simplu email + parolă prin Supabase Auth)  

---

## 6. Verificare & Criterii de Succes pentru Demo

*   **Senzorii & Actuatorii:** Datele DHT11/LDR/ACS712 apar pe site, iar comutarea manuală/automată pornește fizic ventilatoarele/banda LED/PTC.
*   **Audio Live:** Un student conectat pe site aude clar ce se vorbește la microfonul INMP441 în timp real.
*   **Ciclul Înregistrare-Transcriere:** Apăsarea butonului fizic generează un fișier audio și textul transcris în portal sub structura corectă de directoare.
*   **RAG Chat:** Întrebarea *"Despre ce s-a vorbit în cursul de azi?"* întoarce un rezumat corect extras din transcriptul stocat în Supabase.
