// Nu necesita librarii externe (foloseste functiile native ADC si LEDC din Arduino Core)

// Pini conform BOM si firmware:
const int pinCurr = 35;     // Intrare analogica senzor curent ACS712
const int potPin = 34;      // Intrare analogica potentiometru (pentru control)
const int actuatorPin = 17; // Iesire PWM catre MOSFET (implicit Banda LED pin 26, schimba pe 25 pt Ventilatoare sau 17 pt PTC)

// Parametri PWM (compatibil ESP32 Core 3.0+)
const int freq = 5000;
const int resolution = 8; // Valori intre 0 si 255

void setup() {
  Serial.begin(115200);

  // Setare atenuare ADC la 11dB (plaja 0 - 3.3V) pe ESP32
  analogSetPinAttenuation(pinCurr, ADC_11db);
  analogSetPinAttenuation(potPin, ADC_11db);

  // Configurare PWM pentru controlul MOSFET-ului
  ledcAttach(actuatorPin, freq, resolution);

  Serial.println("Test senzor curent ACS712 + Control Actuator inceput...");
  Serial.println("Rotiti potentiometrul pentru a controla sarcina de 12V si a citi consumul.");
}

void loop() {
  // --- 1. LOGICA CONTROL PWM PRIN POTENTIOMETRU ---
  int valPot = analogRead(potPin);
  
  // Mapam citirea analogica (0-4095) la duty cycle PWM (0-255)
  int vitezaPWM = map(valPot, 0, 4095, 0, 255);
  
  // Trimitem semnalul PWM la MOSFET
  ledcWrite(actuatorPin, vitezaPWM);


  // --- 2. LOGICA MASURARE CURENT ACS712 ---
  // Citire si mediere din 20 de esantioane pentru a reduce zgomotul
  float averageRaw = 0;
  for (int i = 0; i < 20; i++) {
    averageRaw += analogRead(pinCurr);
    delay(2);
  }
  averageRaw /= 20.0;

  // Calculare tensiune la pinul ESP32 (plaja 0 - 3.3V, rezolutie 4095)
  float voltageAtPin = (averageRaw / 4095.0) * 3.3;

  // Reconstructia tensiunii originale a senzorului (inainte de divizorul de tensiune 5V -> 3.3V)
  // Factorul de corectie/multiplicare determinat experimental este 1.44
  float sensorVoltage = voltageAtPin * 1.44; 

  // Calcul curent (Amperi) bazat pe sensibilitatea ACS712 (modelul de 5A are 185mV/A sau 0.185V/A)
  // Tensiunea la 0A (zero offset calibrat experimental) este de 2.340V
  float currentAmps = (sensorVoltage - 2.340) / 0.185;

  // Evitam valorile negative cauzate de zgomotul de fond la curent zero
  if (currentAmps < 0) {
    currentAmps = 0.0;
  }


  // --- 3. AFISARE DATE PE SERIAL MONITOR ---
  Serial.print("PWM: ");
  Serial.print(vitezaPWM);
  Serial.print("/255");
  Serial.print(" | ADC Current Raw: ");
  Serial.print(averageRaw, 1);
  Serial.print(" | Volt Senzor: ");
  Serial.print(sensorVoltage, 3);
  Serial.print(" V | CURENT: ");
  Serial.print(currentAmps, 3);
  Serial.println(" A");

  delay(300); // Intarziere mai mica (300ms) pentru un feedback mai rapid in consola la rotirea potentiometrului
}
