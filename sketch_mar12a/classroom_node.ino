#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

const char* ssid       = "campus";
const char* password   = "barcelona";
const char* mqttServer = "broker.hivemq.com";
const int mqttPort     = 1883;

WiFiClient espClient;
PubSubClient mqttClient(espClient);

const char* sensorsTopic  = "classroom/sauca/sensors";
const char* commandsTopic = "classroom/sauca/commands";

const int pinLed = 26;   
const int pinFan = 25;   
const int pinPTC = 17;   
const int pinIR1 = 5;    
const int pinIR2 = 23;   
const int pinLDR = 36;   
const int pinCurr = 35;    
const int pinDHT = 16;   

const int freq = 1000;
const int resolution = 8;

#define DHTTYPE DHT11
DHT dht(pinDHT, DHTTYPE);

#define SCREEN_W 128
#define SCREEN_H 64
Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, -1);

int in_count = 0;
int out_count = 0;
int current_persons = 0;
float temperature = 0.0;
int lightLevel = 0;
float currentAmps = 0.0;
String displayField = "All";

unsigned long lastSendTime = 0;
const int sendInterval = 2000;
const unsigned long irTimeout = 500;

void setPWM(int pin, int val) {
  ledcWrite(pin, constrain(val, 0, 255));
}

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
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    
    display.setCursor(0,0);
    display.print("IP: "); display.println(WiFi.localIP());
    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
    
    display.setTextSize(1);
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

  Serial.print("DEBUG CURENT -> Raw ADC: "); Serial.print(averageRaw);
  Serial.print(" | Volt la Pin: "); Serial.println(voltageAtPin);

  float sensorVoltage = voltageAtPin * 1.44; 
  currentAmps = (sensorVoltage - 2.340) / 0.185;
  if (currentAmps < 0) currentAmps = 0.0;
}

void checkIR() {
  if (digitalRead(pinIR1) == LOW) {
    unsigned long startTime = millis();
    while ((millis() - startTime) < irTimeout) {
      if (digitalRead(pinIR2) == LOW) {
        in_count++;
        current_persons = in_count - out_count;
        while(digitalRead(pinIR1) == LOW || digitalRead(pinIR2) == LOW);
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
        while(digitalRead(pinIR1) == LOW || digitalRead(pinIR2) == LOW);
        break;
      }
    }
  }
}

void handleCommand(String cmd) {
  Serial.println("RX CMD: " + cmd);
  if (!cmd.startsWith("CMD;")) return;
  
  String payload = cmd.substring(4);

  if (payload == "PING") {
    mqttClient.publish(sensorsTopic, "PONG");
    Serial.println("Sent: PONG");
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
    Serial.println("Display mode: " + displayField);
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
       Serial.printf("Pin %d set to %d\n", pin, pwm);
    }
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  handleCommand(message);
}

void reconnect() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = "ESP32Client-" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("connected");
      mqttClient.subscribe(commandsTopic);
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  ledcAttach(pinFan, freq, resolution);
  ledcAttach(pinLed, freq, resolution);
  ledcAttach(pinPTC, freq, resolution);

  pinMode(pinIR1, INPUT_PULLUP);
  pinMode(pinIR2, INPUT_PULLUP);
  dht.begin();
  
  Wire.begin(21, 22);
  if(display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.display();
  }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  
  mqttClient.setServer(mqttServer, mqttPort);
  mqttClient.setCallback(callback);

  Serial.println("\nReady. IP: " + WiFi.localIP().toString());
}

void loop() {
  if (!mqttClient.connected()) {
    reconnect();
  }
  mqttClient.loop();

  checkIR();

  if (millis() - lastSendTime >= sendInterval) {
    lastSendTime = millis();
    readSensors();

    String msg = "IP:" + WiFi.localIP().toString() + 
                 ";Persons:" + String(current_persons) + 
                 ";Temperature:" + String(temperature, 1) + 
                 ";Light:" + String(lightLevel) + 
                 ";Curent:" + String(currentAmps, 3);

    mqttClient.publish(sensorsTopic, msg.c_str());
    
    updateDisplay();
    Serial.println("TX: " + msg);
  }
}