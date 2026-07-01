// Nota: GPIO34 este folosit ca intrare analogica (conectat la PIN-ul din mijloc al potentiometrului)
// ATENTIE: Potentiometrul TREBUIE alimentat la pinul de 3.3V al placii (NU la 5V, ADC-ul ESP32 suporta maxim 3.3V).
// TIP: Schimba valoarea 'ledPin' pentru a testa diferiti actuatori legati la MOSFET:
//   - ledPin = 26  -> Testare Banda LED (MOSFET CH1)
//   - ledPin = 25  -> Testare Ventilatoare (MOSFET CH2)
//   - ledPin = 17  -> Testare PTC Heater (MOSFET CH3 - atentie la temperatura!)
const int potPin = 34;    // Pin analogic de intrare (pentru potentiometru)
const int ledPin = 26;    // Pinul GPIO testat (iesire PWM)

// Setari pentru modul PWM nativ al ESP32 (LEDC API 3.0+)
const int freq = 5000;
const int resolution = 8; // Rezolutie de 8 biti (valori intre 0 si 255)

void setup() {
  Serial.begin(115200);
  
  // Configuram PWM nativ pe ESP32 (API 3.0+)
  ledcAttach(ledPin, freq, resolution);
  
  Serial.println("Test PWM inceput (ESP32 Core 3.0+)...");
  Serial.println("Rotiti potentiometrul pentru a modifica intensitatea LED-ului / viteza ventilatorului.");
}

void loop() {
  // Citim valoarea analogica de la potentiometru (0 - 4095)
  int valPot = analogRead(potPin);
  
  // Mapam rezolutia de 12 biti (0-4095) la 8 biti (0-255) pentru PWM
  int viteza = map(valPot, 0, 4095, 0, 255);
  
  // Trimitem semnalul la MOSFET direct pe pin
  ledcWrite(ledPin, viteza);
  
  // Afisam valorile in Serial Monitor
  Serial.print("Valoare Pot (0-4095): ");
  Serial.print(valPot);
  Serial.print("  |  Valoare PWM (0-255): ");
  Serial.println(viteza);
  
  delay(50); // Delay scurt pentru stabilitate
}
