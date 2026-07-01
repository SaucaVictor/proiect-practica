// Nu necesita librarii externe (foloseste functiile native ADC din Arduino Core)

// Definim pinul LDR conform BOM si firmware:
// LDR -> GPIO36 (SVP / A0 pe Wemos R32 - pin doar de intrare analogica)
const int pinLDR = 36;

void setup() {
  // Serial baud rate setat la 115200 pentru consistenta cu restul proiectului
  Serial.begin(115200);

  // Setare atenuare ADC la 11dB (plaja 0 - 3.3V) pe ESP32
  analogSetPinAttenuation(pinLDR, ADC_11db);

  Serial.println("Test senzor de lumina (LDR) inceput...");
  Serial.println("Conectati LDR intr-un divizor de tensiune cu o rezistenta de 10k.");
}

void loop() {
  // Citim valoarea analogica bruta (0 - 4095 pe rezolutia de 12 biti a ESP32)
  int valRaw = analogRead(pinLDR);

  // --- LOGICA DE PROCESARE EXTRASA DIN FIRMWARE ---
  // Mapam rezolutia de 12 biti a ESP32 la o plaja clasica de 10 biti (0 - 1023)
  int lightLevel = map(valRaw, 0, 4095, 0, 1023);

  // --- AFISARE DATE PE SERIAL MONITOR ---
  Serial.print("Valoare Raw ADC (0-4095): ");
  Serial.print(valRaw);
  Serial.print("  |  Nivel Lumina (0-1023): ");
  Serial.print(lightLevel);

  // Mica interpretare rapida a intensitatii luminoase
  if (lightLevel < 200) {
    Serial.println(" -> 🌑 Intuneric");
  } else if (lightLevel < 600) {
    Serial.println(" -> ⛅ Lumina moderata (interior)");
  } else {
    Serial.println(" -> ☀️ Lumina puternica / Soare");
  }

  delay(500); // Rata de citire de 500ms pentru vizualizare stabila
}
