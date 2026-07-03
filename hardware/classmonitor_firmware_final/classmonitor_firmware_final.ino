/*
 * ClassMonitor - Firmware Integrat Final (ESP32 / Wemos D1 R32)
 * 
 * Acest firmware asigura rularea tuturor functionalitatilor proiectului:
 *   1. Telemetrie senzori (DHT11, LDR, ACS712, bariere IR) transmise prin MQTT.
 *   2. Receptie comenzi de control pentru actuatori (LED, Ventilatoare, Incalzire PTC) prin MQTT.
 *   3. Ecran local OLED pentru monitorizarea starii si a datelor senzorilor.
 *   4. Streaming audio in timp real de la microfonul digital I2S (INMP441) prin WebSockets.
 *   5. Control fizic local pentru incepere/oprire inregistrare curs (buton pe GPIO14).
 * 
 * Conexiuni pini (Wemos D1 R32):
 *   - DHT11 DATA        -> GPIO16
 *   - LDR (Lumina)      -> GPIO36 (A4)
 *   - ACS712 (Curent)   -> GPIO35 (A2)
 *   - IR Sensor 1 (In)   -> GPIO5  (D10)
 *   - IR Sensor 2 (Out)  -> GPIO23 (D11)
 *   - Ecran OLED SDA    -> GPIO21
 *   - Ecran OLED SCL    -> GPIO22
 *   - MOSFET CH1 (LED)   -> GPIO26 (D2)
 *   - MOSFET CH2 (Fan)   -> GPIO25 (D3)
 *   - MOSFET CH3 (PTC)   -> GPIO17 (D4)
 *   - Microfon I2S SCK   -> GPIO18 (D13)
 *   - Microfon I2S WS    -> GPIO19 (D12)
 *   - Microfon I2S SD    -> GPIO13 (D9)
 *   - Buton inregistrare -> GPIO14 (D7) -> legat la GND la apasare
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <WebSocketsClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <driver/i2s.h>

// ─── CONFIGURARE CONEXIUNI REȚEA ȘI SERVERE ───
const char* ssid       = "your_ssid";
const char* password   = "your_password";

// Configurare Broker MQTT (pentru telemetrie si comenzi smart control)
const char* mqttServer = "broker.hivemq.com";
const int mqttPort     = 1883;

// Configurare Server Audio (pentru streaming audio websocket)
const char* wsHost     = "your_ip"; // IP-ul local al calculatorului tau
const int wsPort       = 8001;

// ─── INSTANȚE ȘI STATE CLIENT ───
WiFiClient espClient;
PubSubClient mqttClient(espClient);
WebSocketsClient webSocket;

bool wsConnected = false;
bool isRecording = false;

// ─── CONFIGURARE TOPICE MQTT ───
const char* telemetryTopic = "iot/classmonitor/telemetry";
const char* controlTopic   = "iot/classmonitor/control";

// ─── PINOUT CONCORDANT CU BOM ───
const int pinLed    = 26;   // PWM OUT - MOSFET CH1 (LED)
const int pinFan    = 25;   // PWM OUT - MOSFET CH2 (Ventilatoare)
const int pinPTC    = 17;   // PWM OUT - MOSFET CH3 (Incalzire)
const int pinIR1    = 5;    // Digital IN - Senzor IR 1 (Bariera Intrare)
const int pinIR2    = 23;   // Digital IN - Senzor IR 2 (Bariera Iesire)
const int pinLDR    = 36;   // Analog IN - LDR
const int pinCurr   = 35;   // Analog IN - ACS712
const int pinDHT    = 16;   // Digital IN - DHT11
const int buttonPin = 14;   // Digital IN - Buton inregistrare extern (D7)

// ─── CONFIGURARE PINI I2S (MICROFON INMP441) ───
#define I2S_WS  19
#define I2S_SD  13
#define I2S_SCK 18
#define I2S_PORT I2S_NUM_0
#define SAMPLE_RATE 16000

// Buffere pentru procesare date audio
const int BLOCK_SIZE = 128;
int32_t i2s_raw_buffer[BLOCK_SIZE];
int16_t pcm16_buffer[BLOCK_SIZE];

// ─── CONFIGURARE PARAMETRI DE FUNCTIONARE ───
const int freq = 5000;
const int resolution = 8;

#define DHTTYPE DHT11
DHT dht(pinDHT, DHTTYPE);

#define SCREEN_W 128
#define SCREEN_H 64
Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, -1);

// Variabile stare senzori
int in_count = 0;
int out_count = 0;
int current_persons = 0;
float temperature = 0.0;
int lightLevel = 0;
float currentAmps = 0.0;
String displayField = "All";

unsigned long lastSendTime = 0;
const int sendInterval = 2000;      // Trimite telemetrie la 2 secunde
const unsigned long irTimeout = 500; // Fereastra directie trecere (ms)
bool lastButtonState = HIGH;

// ─── INITIALIZARE I2S PENTRU MICROFON ───
void initI2S() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 64,
    .use_apll = false
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD
  };

  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_PORT, &pin_config);
  i2s_zero_dma_buffer(I2S_PORT);
}

// ─── CONTROL PWM MOSFET ───
void setPWM(int pin, int val) {
  ledcWrite(pin, constrain(val, 0, 255));
}

// ─── EVENT HANDLER WEBSOCKET ───
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Deconectat de la serverul audio!");
      wsConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.printf("[WS] Conectat la serverul audio pe %s\n", payload);
      wsConnected = true;
      break;
    case WStype_TEXT:
      Serial.printf("[WS] Mesaj text de la server: %s\n", payload);
      break;
  }
}

// ─── ACTUALIZARE OLED ───
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
  float t = dht.readTemperature();
  if (!isnan(t)) temperature = t;

  lightLevel = map(analogRead(pinLDR), 0, 4095, 0, 1023);
  
  float averageRaw = 0;
  for (int i = 0; i < 20; i++) {
    averageRaw += analogRead(pinCurr);
    delay(2);
  }
  averageRaw /= 20.0;

  float voltageAtPin = (averageRaw / 4095.0) * 3.3;
  float sensorVoltage = voltageAtPin * 1.44; 
  currentAmps = (sensorVoltage - 2.340) / 0.185; 
  if (currentAmps < 0) currentAmps = 0.0;
}

// ─── MONITORIZARE BARIERE INFRAROSU ───
void checkIR() {
  if (digitalRead(pinIR1) == LOW) {
    unsigned long startTime = millis();
    while ((millis() - startTime) < irTimeout) {
      if (digitalRead(pinIR2) == LOW) {
        in_count++;
        current_persons = in_count - out_count;
        
        unsigned long waitStart = millis();
        while(digitalRead(pinIR1) == LOW || digitalRead(pinIR2) == LOW) {
          mqttClient.loop();
          webSocket.loop(); // Mentinem conexiunea audio in timpul trecerii
          if (millis() - waitStart > 3000) break;
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
        
        unsigned long waitStart = millis();
        while(digitalRead(pinIR1) == LOW || digitalRead(pinIR2) == LOW) {
          mqttClient.loop();
          webSocket.loop(); // Mentinem conexiunea audio in timpul trecerii
          if (millis() - waitStart > 3000) break;
          delay(10);
        }
        break;
      }
    }
  }
}

// ─── PROCESARE COMENZI PRIMITE (MQTT) ───
void handleCommand(String cmd) {
  Serial.println("RX CMD: " + cmd);
  if (!cmd.startsWith("CMD;")) return;
  
  String payload = cmd.substring(4);

  if (payload == "PING") {
    mqttClient.publish(telemetryTopic, "PONG");
    return;
  }

  if (payload == "RESET") {
    Serial.println("Resetting ESP32...");
    delay(500);
    ESP.restart();
    return;
  }

  if (payload.startsWith("LCD:")) {
    displayField = payload.substring(4);
    displayField.trim();
    updateDisplay();
    return;
  }

  int colonIdx = payload.indexOf(':');
  if (colonIdx != -1) {
    int pin = payload.substring(0, colonIdx).toInt();
    int val = payload.substring(colonIdx + 1).toInt();
    int pwm = (val == 1) ? 255 : val;

    if (pin == pinLed || pin == pinFan || pin == pinPTC) {
       setPWM(pin, pwm);
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

// ─── RECONECTARE MQTT ───
void reconnect() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = "ESP32ClassMonitor-" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("connected");
      mqttClient.subscribe(controlTopic);
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" reincercare in 5 secunde");
      delay(5000);
    }
  }
}

// ─── SETUP ───
void setup() {
  Serial.begin(115200);

  // Configurare pini MOSFET ca iesiri PWM
  ledcAttach(pinFan, freq, resolution);
  ledcAttach(pinLed, freq, resolution);
  ledcAttach(pinPTC, freq, resolution);

  // Configurare intrari senzori si buton extern
  pinMode(pinIR1, INPUT_PULLUP);
  pinMode(pinIR2, INPUT_PULLUP);
  pinMode(buttonPin, INPUT_PULLUP);
  dht.begin();
  
  // Initializare OLED
  Wire.begin(21, 22);
  if(display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.display();
  }

  // Conectare WiFi
  WiFi.begin(ssid, password);
  Serial.print("Conectare WiFi");
  while (WiFi.status() != WL_CONNECTED) { 
    delay(500); 
    Serial.print("."); 
  }
  Serial.println("\nWiFi conectat. IP: " + WiFi.localIP().toString());

  // Initializare driver I2S pentru microfon
  initI2S();

  // Configurare WebSocket
  webSocket.begin(wsHost, wsPort, "/ws/audio");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);

  // Configurare MQTT
  mqttClient.setServer(mqttServer, mqttPort);
  mqttClient.setCallback(callback);

  Serial.println("Initializare completa. Sistem gata.");
}

// ─── LOOP PRINCIPAL ───
void loop() {
  // Gestionare conexiune MQTT
  if (!mqttClient.connected()) {
    reconnect();
  }
  mqttClient.loop();

  // Gestionare loop WebSocket (keep-alive, mesaje administrative)
  webSocket.loop();

  // Monitorizare non-blocanta bariere infrarosu
  checkIR();

  // Citire senzori si trimitere telemetrie MQTT periodica (la fiecare 2s)
  if (millis() - lastSendTime >= sendInterval) {
    lastSendTime = millis();
    readSensors();

    String msg = "IP:" + WiFi.localIP().toString() + 
                 ";Persons:" + String(current_persons) + 
                 ";Temperature:" + String(temperature, 1) + 
                 ";Light:" + String(lightLevel) + 
                 ";Curent:" + String(currentAmps, 3);

    mqttClient.publish(telemetryTopic, msg.c_str());
    updateDisplay();
    Serial.println("TX: " + msg);
  }

  // Citire microfon si transmitere audio daca suntem conectati la WebSocket si inregistrarea e activa
  if (wsConnected && isRecording) {
    size_t bytes_read = 0;
    // Citim datele cu un timeout mic (10ms) pentru a nu bloca rularea celorlalte procese din loop
    i2s_read(I2S_PORT, &i2s_raw_buffer, sizeof(i2s_raw_buffer), &bytes_read, 10 / portTICK_PERIOD_MS);
    int samples_read = bytes_read / 4;
    
    if (samples_read > 0) {
      for (int i = 0; i < samples_read; i++) {
        // Conversie 32-bit la 16-bit PCM cu deplasare si amplificare
        pcm16_buffer[i] = (int16_t)(i2s_raw_buffer[i] >> 14);
      }
      // Transmitem calupul binar de audio catre serverul audio
      webSocket.sendBIN((uint8_t*)pcm16_buffer, samples_read * 2);
    }
  }

  // Verificare si debounce buton fizic extern pentru incepere/oprire inregistrare
  bool buttonState = digitalRead(buttonPin);
  if (buttonState == LOW && lastButtonState == HIGH) {
    delay(50); // Debounce
    if (digitalRead(buttonPin) == LOW) {
      isRecording = !isRecording;
      if (isRecording) {
        Serial.println("[REC] Start inregistrare... Trimit RECORD_START");
        if (wsConnected) {
          webSocket.sendTXT("RECORD_START");
        }
      } else {
        Serial.println("[REC] Stop inregistrare... Trimit RECORD_STOP");
        if (wsConnected) {
          webSocket.sendTXT("RECORD_STOP");
        }
      }
    }
  }
  lastButtonState = buttonState;
}
