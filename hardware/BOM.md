# Bill of Materials — ClassMonitor

**Proiect:** ClassMonitor — Sală de curs instrumentată  
**Responsabili hardware:** Tuțu Cristian, Bucura Ion-Bogdan  
**Ultima actualizare:** 2026-06-30

---

## Microcontroler

| Componentă | Model | Cantitate | Interfață | Observații |
|---|---|---|---|---|
| Microcontroler | Wemos D1 R32 (ESP32) | 1 | WiFi / BT | Form factor Arduino UNO, dual-core, WiFi integrat |

---

## Senzori

| Componentă | Model | Cantitate | Interfață | Observații |
|---|---|---|---|---|
| Temperatură / Umiditate | DHT11 | 1 | Digital (1-wire) | Rezoluție 1°C / 1% RH; pull-up 10kΩ pe DATA |
| Lumină (fotorezistor) | LDR | 1 | Analog | Divizor de tensiune cu rezistență fixă (10kΩ rec.) |
| Prezență | Senzor IR (2x) | 2 | Digital | Detectare prezență în sală; plasați la intrare/ieșire |
| Curent | ACS712 (5A) | 1 | Analog | Management energetic; ales modelul în funcție de sarcina maximă |
| Microfon | INMP441 | 1 | I2S | Înregistrare cursuri; necesită 3.3V; pini: SCK, WS, SD |

---

## Actuatori

| Componentă | Model | Cantitate | Tensiune | Control |
|---|---|---|---|---|
| Ventilator | DC Fan | 2 | 12V | PWM via MOSFET |
| Încălzire | PTC Heater | 1 | 12V | PWM via MOSFET (cu limitare temp!) |
| Iluminat | Bandă LED | 1 | 12V | PWM via MOSFET |

---

## Afișaj

| Componentă | Model | Cantitate | Interfață | Observații |
|---|---|---|---|---|
| Display local | OLED 0.96" | 1 | I2C (SDA/SCL) | Afișare date în timp real pe dispozitiv |

---

## Electronică de putere

| Componentă | Model | Cantitate | Observații |
|---|---|---|---|
| MOSFET N-channel | IR540N | 4 | 100V / 28A; comutare PWM 12V pentru toți actuatorii |
| Sursă alimentare | 12V DC | 1 | Alimentare principală sistem |
| Regulator tensiune | 12V → 5V / 3.3V | 1 | Alimentare ESP32 + senzori de la sursa de 12V |

---

## Componente pasive

| Componentă | Valoare | Cantitate | Utilizare |
|---|---|---|---|
| Rezistență | 10 kΩ | 3 | Divizor de tensiune ACS712 (ieșire 5V → 3.3V pentru ADC ESP32) |
| Rezistență | 10 kΩ | 1 | Pull-down LDR (divizor de tensiune cu fotorezistorul) |
| Potențiometru | 10 kΩ (sau similar) | 1 | Folosit pentru testare manuală semnale PWM (LED/Ventilator) |
| Buton tactil (push-button) | Omron B3F (sau similar) | 1 | Buton fizic extern pentru control înregistrare audio (start/stop) |

---

## Note tehnice

### Alimentare
- Sistemul rulează pe **12V** (sursă externă)
- Actuatorii (ventilatoare, PTC, bandă LED) sunt comandați direct la 12V prin **MOSFET IR540N**
- ESP32 și senzorii sunt alimentați la **3.3V / 5V** printr-un regulator de tensiune step-down

### Control actuatori (PWM prin MOSFET)
- **IR540N** (N-channel, 100V / 28A) permite control PWM al sarcinilor de 12V direct din GPIO-urile ESP32 (3.3V logic)
- 4 canale disponibile: ventilator 1, ventilator 2, PTC, bandă LED
- Gate-ul MOSFET necesită rezistență de 100–220Ω în serie cu GPIO

### PTC Heater — atenție
- PTC-ul trebuie monitorizat cu termistor sau limitat prin logică software (prag maxim temp)
- Nu lăsați PWM la 100% pe PTC fără supraveghere termică

### INMP441 — microfon I2S
- Necesită 3.3V (nu 5V!)
- Pini necesari pe ESP32: `SCK`, `WS` (LRCLK), `SD` (data)
- Adaugă complexitate față de MVP inițial — tratați ca **feature opțional** dacă presiunea de timp crește

### ACS712 — senzor de curent
- Ales modelul în funcție de curentul maxim al sarcinii (5A / 20A / 30A)
- Ieșire analogică: 2.5V la 0A, sensibilitate 185mV/A (model 5A)
- Conectat pe linia de 12V a actuatorilor

---

## Pinout ESP32 (Wemos D1 R32) — confirmat în firmware

| Pin GPIO | Funcție | Componentă |
|---|---|---|
| **Senzori** | | |
| GPIO16 | Digital IN | DHT11 DATA |
| GPIO36 | Analog IN | LDR (input-only) |
| GPIO35 | Analog IN | ACS712 OUT (input-only) |
| GPIO5 | Digital IN | IR Senzor 1 |
| GPIO23 | Digital IN | IR Senzor 2 |
| GPIO34 | Analog IN | Potențiometru (pentru testare / debug) |
| **Actuatori — MOSFET IR540N** | | |
| GPIO26 | PWM OUT | CH1 — Bandă LED |
| GPIO25 | PWM OUT | CH2 — Ventilatoare (2x în paralel) |
| GPIO17 | PWM OUT | CH3 — PTC Heater |
| *(liber)* | *(PWM OUT)* | CH4 — nealocat |
| **Afișaj** | | |
| GPIO21 | I2C SDA | OLED 0.96" |
| GPIO22 | I2C SCL | OLED 0.96" |
| **Microfon / Înregistrare** | | |
| GPIO18 | I2S SCK | INMP441 — bit clock |
| GPIO19 | I2S WS | INMP441 — word select (LRCLK) |
| GPIO13 | I2S SD | INMP441 — data |
| GPIO14 | Digital IN | Buton extern start/stop înregistrare (cu pull-up intern) |

> **Notă:** GPIO35 și GPIO36 sunt input-only pe ESP32 — nu au pull-up intern, nu pot fi OUTPUT. Perfect pentru ADC.  
> **Notă:** GPIO23 folosit pentru IR2; dacă adăugați SPI ulterior, va trebui realocate.  
> **Notă:** INMP441 necesită alimentare la **3.3V** (nu 5V!). GPIO18/19/13 sunt liberi și compatibili I2S.  
> **Notă:** Butonul de înregistrare folosește GPIO14 (D7) cu rezistența internă de pull-up a ESP32 (INPUT_PULLUP), deci se conectează direct între GPIO14 și GND, fără rezistență externă pe breadboard.
