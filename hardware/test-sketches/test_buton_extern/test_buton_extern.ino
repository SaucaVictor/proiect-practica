/*
 * Test Buton Extern (ESP32 / Wemos D1 R32)
 * 
 * Acest cod testeaza functionarea unui buton extern (push-button)
 * conectat intre pinul GPIO14 (D7) si GND, folosind rezistenta interna
 * de pull-up a ESP32 (nu este nevoie de rezistenta externa pe breadboard).
 * 
 * Conexiuni:
 *   - Un piciorus al butonului -> GPIO14 (D7)
 *   - Celalalt piciorus -> GND
 */

const int buttonPin = 14; // GPIO14 (marcat ca D7 pe placa)
bool lastButtonState = HIGH;
int pressCount = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n=========================================");
  Serial.println("       TEST BUTON EXTERN (GPIO14/D7)     ");
  Serial.println("=========================================");
  Serial.println("Apasati butonul pentru a verifica conexiunile.");
  Serial.println("-----------------------------------------");

  // Configuram pinul ca intrare cu pull-up intern activat.
  // In stare normala (neapasat), pinul va citi HIGH.
  // Cand butonul este apasat, pinul este legat la GND si va citi LOW.
  pinMode(buttonPin, INPUT_PULLUP);
  
  Serial.println("Initializare completa. Se asteapta apasarea butonului...");
}

void loop() {
  bool buttonState = digitalRead(buttonPin);

  // Detectam tranzitia de apasare: de la HIGH (neapasat) la LOW (apasat)
  if (buttonState == LOW && lastButtonState == HIGH) {
    delay(50); // Debounce hardware/software simplu pentru a elimina zgomotul de contact
    if (digitalRead(buttonPin) == LOW) {
      pressCount++;
      Serial.printf("[BUTON] Stare: APASAT | Numar total apasari: %d\n", pressCount);
    }
  } 
  // Detectam tranzitia de eliberare: de la LOW (apasat) la HIGH (neapasat)
  else if (buttonState == HIGH && lastButtonState == LOW) {
    delay(50); // Debounce
    if (digitalRead(buttonPin) == HIGH) {
      Serial.println("[BUTON] Stare: ELIBERAT");
    }
  }

  // Salvam starea curenta pentru urmatoarea comparatie
  lastButtonState = buttonState;
  
  delay(10); // Scurta intarziere pentru stabilitate
}
