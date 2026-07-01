// Necesita libraria din Arduino Library Manager:
//   - "WebSockets" de Markus Sattler (pentru WebSocketsClient)

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <driver/i2s.h>

// ─── CONFIGURARE CONEXIUNE ───
const char* ssid     = "campus";
const char* password = "barcelona";
const char* ws_host  = "192.168.1.100"; // Modifica cu IP-ul real al serverului tau audio (server.py)
const int ws_port    = 8001;            // Portul serverului audio din server.py

WebSocketsClient webSocket;
bool isConnected = false;

// ─── CONFIGURARE PINI I2S PENTRU MICROFON (INMP441) ───
#define I2S_WS 19   // LRCLK (Word Select)
#define I2S_SD 13   // SD (Serial Data)
#define I2S_SCK 18  // SCK (Bit Clock)

#define I2S_PORT I2S_NUM_0
#define SAMPLE_RATE 16000 // Serverul audio (server.py) asteapta exact 16000Hz

// Buffer pentru citire I2S (citim calupuri de 128 de esantioane pe 32 biti)
const int BLOCK_SIZE = 128;
int32_t i2s_raw_buffer[BLOCK_SIZE];
int16_t pcm16_buffer[BLOCK_SIZE];

// ─── CONFIGURARE BUTON TEST INREGISTRARE ───
const int buttonPin = 0; // Butonul BOOT/Flash de pe placa (apasare -> incepere/oprire inregistrare)
bool isRecording = false;
bool lastButtonState = HIGH;

// ─── INITIALIZARE I2S PENTRU MICROFON DIGITAL ───
void initI2S() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT, // INMP441 transmite date pe 24 de biti impachetate in 32 de biti
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,  // Mono
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

// ─── EVENT HANDLER WEBSOCKET ───
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Deconectat de la serverul audio!");
      isConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.printf("[WS] Conectat la serverul audio: %s\n", payload);
      isConnected = true;
      break;
    case WStype_TEXT:
      Serial.printf("[WS] Mesaj primit de la server: %s\n", payload);
      break;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(buttonPin, INPUT_PULLUP);

  // Initializare I2S pentru microfon
  initI2S();

  // Conectare WiFi
  WiFi.begin(ssid, password);
  Serial.print("Conectare WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Conectat. IP: " + WiFi.localIP().toString());

  // Configurare WebSocket client (endpoint-ul din server.py)
  webSocket.begin(ws_host, ws_port, "/ws/audio");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000); // Reincercare conexiune la 5s
}

void loop() {
  webSocket.loop();

  // Daca nu suntem conectati la server, nu citim microfonul pentru a nu umple bufferul DMA
  if (!isConnected) {
    delay(10);
    return;
  }

  // 1. CITIRE DATE MICROFON (INMP441)
  size_t bytes_read = 0;
  i2s_read(I2S_PORT, &i2s_raw_buffer, sizeof(i2s_raw_buffer), &bytes_read, portMAX_DELAY);
  
  int samples_read = bytes_read / 4; // Fiecare esantion brut are 4 bytes (32-bit)

  // 2. CONVERSIE 32-BIT LA 16-BIT PCM (Cerinta server.py)
  // INMP441 scoate pe 24 de biti aliniati la stanga.
  // Schimbam bitii spre dreapta cu 14 biti pentru a aduce valoarea in intervalul int16_t cu o amplificare optima
  for (int i = 0; i < samples_read; i++) {
    pcm16_buffer[i] = (int16_t)(i2s_raw_buffer[i] >> 14);
  }

  // 3. TRANSMISIE BINARA PE WEBSOCKET (Flux continuu)
  webSocket.sendBIN((uint8_t*)pcm16_buffer, samples_read * 2); // 2 bytes per esantion int16

  // 4. TEST PORNIRE / OPRIRE INREGISTRARE (BUTON FIZIC)
  bool buttonState = digitalRead(buttonPin);
  if (buttonState == LOW && lastButtonState == HIGH) {
    delay(50); // Debounce
    if (digitalRead(buttonPin) == LOW) {
      isRecording = !isRecording;
      if (isRecording) {
        Serial.println("[REC] Trimit comanda: RECORD_START");
        webSocket.sendTXT("RECORD_START");
      } else {
        Serial.println("[REC] Trimit comanda: RECORD_STOP");
        webSocket.sendTXT("RECORD_STOP");
      }
    }
  }
  lastButtonState = buttonState;
}
