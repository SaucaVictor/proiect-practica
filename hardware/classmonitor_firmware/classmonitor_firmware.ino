// Necesita urmatoarele librarii externe din Library Manager:
//   1. "PubSubClient" de Nick O'Leary (pentru MQTT)
//   2. "DHT sensor library" de Adafruit (pentru DHT11)
//   3. "Adafruit SSD1306" si "Adafruit GFX Library" (pentru ecranul OLED)

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

// ─── CONFIGURARE CONEXIUNI REȚEA ───
const char* ssid       = "your_network";
const char* password   = "your_password";
const char* mqttServer = "broker.hivemq.com";
const int mqttPort     = 1883;

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ─── CONFIGURARE TOPICE MQTT ───
// Canal publicare date telemetrie senzori
const char* telemetryTopic = "iot/classmonitor/telemetry";

// Canal receptie comenzi control actuatori
const char* controlTopic   = "iot/classmonitor/control";

// ─── PINOUT CONCORDANT CU BOM ───
const int pinLed  = 26;   // PWM OUT - MOSFET CH1 (Banda LED)
const int pinFan  = 25;   // PWM OUT - MOSFET CH2 (Ventilatoare in paralel)
const int pinPTC  = 17;   // PWM OUT - MOSFET CH3 (PTC Heater)
const int pinIR1  = 5;    // Digital IN - Senzor IR 1 (Bariera Intrare)
const int pinIR2  = 23;   // Digital IN - Senzor IR 2 (Bariera Iesire)
const int pinLDR  = 36;   // Analog IN - Fotorezistor (input-only pe ESP32)
const int pinCurr = 35;   // Analog IN - Senzor Curent ACS712 (input-only pe ESP32)
const int pinDHT  = 16;   // Digital IN - Senzor DHT11 DATA

// ─── CONFIGURARE SEMNAL PWM (LEDC) ───
const int freq = 5000;     // Frecventa semnal PWM
const int resolution = 8;  // Rezolutie PWM pe 8 biti (plaja 0 - 255)

// ─── CONFIGURARE SENZORI ȘI DISPLAY ───
#define DHTTYPE DHT11
DHT dht(pinDHT, DHTTYPE);

#define SCREEN_W 128
#define SCREEN_H 64
Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, -1);

// ─── VARIABILE DE STARE (TELEMETRIE) ───
int in_count = 0;
int out_count = 0;
int current_persons = 0;
float temperature = 0.0;
int lightLevel = 0;
float currentAmps = 0.0;
String displayField = "All";

unsigned long lastSendTime = 0;
const int sendInterval = 2000;     // Transmisie telemetrie la fiecare 2 secunde
const unsigned long irTimeout = 500; // Fereastra de detectie directie trecere (ms)

// ─── CONTROL PWM MOSFET ───
void setPWM(int pin, int val) {
  ledcWrite(pin, constrain(val, 0, 255));
}

// ─── ACTUALIZARE AFISARE OLED ───
void updateDisplay() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,0);

  if (displayField == "Curent") {
    display.println("--- CURENT ---");
    display.setTextSize(2);
    display.setCursor(10, 25);
    display.printf("%.2f A", currentAmps);
  } 
  else if (displayField == "Light") {
    display.println("--- LUMINA ---");
    display.setTextSize(2);
    display.setCursor(10, 25);
    display.printf("%d", lightLevel);
  }
  else if (displayField == "Temperature") {
    display.println("--- TEMPERATURA ---");
    display.setTextSize(2);
    display.setCursor(10, 25);
    display.printf("%.1f C", temperature);
  }
  else if (displayField == "Persons") {
    display.println("--- PERSOANE ---");
    display.setTextSize(3);
    display.setCursor(30, 25);
    display.printf("%d", current_persons);
  }
  else {
    // Afisaj complet (All)
    display.print("IP: "); display.println(WiFi.localIP());
    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
    
    display.setCursor(0, 18);
    display.printf("PERSOANE:    %d", current_persons);
    
    display.setCursor(0, 30);
    display.printf("TEMP:        %.1f C", temperature);
    
    display.setCursor(0, 42);
    display.printf("LUMINA:      %d", lightLevel);
    
    display.setCursor(0, 54);
    display.printf("CURENT:      %.3f A", currentAmps);
  }
  display.display();
}

// ─── CITIREA SENZORILOR ───
void readSensors() {
  // Citire temperatura DHT11
  float t = dht.readTemperature();
  if (!isnan(t)) temperature = t;

  // Citire fotorezistor si mapare la scara 10 biti
  lightLevel = map(analogRead(pinLDR), 0, 4095, 0, 1023);
  
  // Citire curent ACS712 cu filtrare activa (20 esantioane)
  float averageRaw = 0;
  for (int i = 0; i < 20; i++) {
    averageRaw += analogRead(pinCurr);
    delay(2);
  }
  averageRaw /= 20.0;

  // Calcule pentru calibrare zero-offset si divizor tensiune
  float voltageAtPin = (averageRaw / 4095.0) * 3.3;
  float sensorVoltage = voltageAtPin * 1.44; // Factor divizor tensiune
  currentAmps = (sensorVoltage - 2.340) / 0.185; // Sensibilitate model 5A
  if (currentAmps < 0) currentAmps = 0.0;

  Serial.print("DEBUG CURENT -> Raw ADC: "); Serial.print(averageRaw);
  Serial.print(" | Volt la Pin: "); Serial.print(voltageAtPin);
  Serial.print(" | Amperi: "); Serial.println(currentAmps, 3);
}

// ─── MONITORIZARE BARIERE INFRAROSU ───
void checkIR() {
  if (digitalRead(pinIR1) == LOW) {
    unsigned long startTime = millis();
    while ((millis() - startTime) < irTimeout) {
      if (digitalRead(pinIR2) == LOW) {
        in_count++;
        current_persons = in_count - out_count;
        
        // Mentinere conexiune MQTT activa pe durata trecerii
        unsigned long waitStart = millis();
        while(digitalRead(pinIR1) == LOW || digitalRead(pinIR2) == LOW) {
          mqttClient.loop(); 
          if (millis() - waitStart > 3000) break; // Timeout siguranta 3s
          delay(10);
        }
        break;
      }
    }
  }
  else if (digitalRead(pinIR2) == LOW) {
    unsigned long startTime = millis();
    while ((millis() - startTime) < irTimeout) {
      if (digitalRead(pinIR1) == LOW) {
        if (in_count > out_count) {
          out_count++;
          current_persons = in_count - out_count;
        }
        
        // Mentinere conexiune MQTT activa pe durata trecerii
        unsigned long waitStart = millis();
        while(digitalRead(pinIR1) == LOW || digitalRead(pinIR2) == LOW) {
          mqttClient.loop();
          if (millis() - waitStart > 3000) break; // Timeout siguranta 3s
          delay(10);
        }
        break;
      }
    }
  }
}

// ─── PROCESARE COMENZI PRIMITE ───
void handleCommand(String cmd) {
  Serial.println("RX CMD: " + cmd);
  if (!cmd.startsWith("CMD;")) return;
  
  String payload = cmd.substring(4);

  // Comanda PING-PONG pentru testare conexiune
  if (payload == "PING") {
    mqttClient.publish(telemetryTopic, "PONG");
    Serial.println("Sent: PONG");
    return;
  }

  // Comanda de RESET hardware de la distanta
  if (payload == "RESET") {
    Serial.println("Resetting ESP32...");
    delay(500);
    ESP.restart();
    return;
  }

  // Comanda comutare mod afisaj OLED
  if (payload.startsWith("LCD:")) {
    displayField = payload.substring(4);
    displayField.trim();
    Serial.println("Display mode: " + displayField);
    updateDisplay();
    return;
  }

  // Control PWM actuatori (Format payload: "pin:valoare", ex: "26:128")
  int colonIdx = payload.indexOf(':');
  if (colonIdx != -1) {
    int pin = payload.substring(0, colonIdx).toInt();
    int val = payload.substring(colonIdx + 1).toInt();
    int pwm = (val == 1) ? 255 : val; // Conversie stare digitala ON la PWM maxim

    if (pin == pinLed || pin == pinFan || pin == pinPTC) {
       setPWM(pin, pwm);
       Serial.printf("Pin %d set to %d\n", pin, pwm);
    }
  }
}

// ─── CALLBACK MQTT ───
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  handleCommand(message);
}

// ─── RECONECTARE REȚEA MQTT ───
void reconnect() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = "ESP32ClassMonitor-" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("connected");
      // Ne abonam la topic-ul de comenzi/control
      mqttClient.subscribe(controlTopic);
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// ─── SETUP INITIALIZARE ───
void setup() {
  Serial.begin(115200);

  // Configurare canale PWM pentru actuatori
  ledcAttach(pinFan, freq, resolution);
  ledcAttach(pinLed, freq, resolution);
  ledcAttach(pinPTC, freq, resolution);

  // Initializare intrari senzori
  pinMode(pinIR1, INPUT_PULLUP);
  pinMode(pinIR2, INPUT_PULLUP);
  dht.begin();
  
  // Initializare ecran OLED pe pinii definiti in BOM (21 si 22)
  Wire.begin(21, 22);
  if(display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.display();
  }

  // Conectare retea WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { 
    delay(500); 
    Serial.print("."); 
  }
  
  mqttClient.setServer(mqttServer, mqttPort);
  mqttClient.setCallback(callback);

  Serial.println("\nReady. IP: " + WiFi.localIP().toString());
}

// ─── LOOP PRINCIPAL DE RULARE ───
void loop() {
  if (!mqttClient.connected()) {
    reconnect();
  }
  mqttClient.loop();

  // Verificam senzorii de trecere (IR)
  checkIR();

  // Transmitem datele periodic la intervalul setat
  if (millis() - lastSendTime >= sendInterval) {
    lastSendTime = millis();
    readSensors();

    // Compunem payload-ul de telemetrie pentru server
    String msg = "IP:" + WiFi.localIP().toString() + 
                 ";Persons:" + String(current_persons) + 
                 ";Temperature:" + String(temperature, 1) + 
                 ";Light:" + String(lightLevel) + 
                 ";Curent:" + String(currentAmps, 3);

    mqttClient.publish(telemetryTopic, msg.c_str());
    
    updateDisplay();
    Serial.println("TX: " + msg);
  }
}
