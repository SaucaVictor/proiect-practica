/*
 * Test Offline Microfon INMP441 (ESP32)
 * 
 * Acest cod testeaza functionarea microfonului digital I2S (INMP441)
 * fara a fi necesara o conexiune WiFi, WebSocket sau alte servicii online.
 * Citeste semnalul audio direct din microfon si afiseaza un indicator de
 * volum (VU-meter) in Serial Monitor sub forma de caractere ASCII.
 * 
 * Conexiuni pini (ESP32 - INMP441) conform BOM:
 *   - L/R         -> GND (pentru canalul stang / Left Channel)
 *   - LRCLK (WS)  -> GPIO19
 *   - SCK         -> GPIO18
 *   - GND         -> GND
 *   - VDD         -> 3.3V
 *   - SD          -> GPIO13
 */

#include <driver/i2s.h>

// ─── CONFIGURARE PINI I2S PENTRU MICROFON (INMP441) CONFORM BOM ───
#define I2S_WS 19   // GPIO19 -> LRCLK (Word Select)
#define I2S_SD 13   // GPIO13 -> SD (Serial Data)
#define I2S_SCK 18  // GPIO18 -> SCK (Bit Clock)

#define I2S_PORT I2S_NUM_0
#define SAMPLE_RATE 16000 // Frecventa de esantionare standard pentru test

// Buffer pentru citirea datelor I2S
const int BLOCK_SIZE = 128;
int32_t i2s_raw_buffer[BLOCK_SIZE];

// Initializare driver I2S pentru ESP32
void initI2S() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT, // INMP441 are date pe 24 biti, trimise in slot-uri de 32 biti
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,  // Citim un singur canal (mono)
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

  // Instalam driverul I2S si configuram pinii fizici
  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_PORT, &pin_config);
  i2s_zero_dma_buffer(I2S_PORT);
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n=========================================");
  Serial.println("       TEST RAPID MICROFON INMP441       ");
  Serial.println("=========================================");
  Serial.printf("Configuratie pini I2S (conform BOM):\n");
  Serial.printf("  SCK  (Bit Clock)   -> GPIO%d\n", I2S_SCK);
  Serial.printf("  WS   (Word Select)  -> GPIO%d\n", I2S_WS);
  Serial.printf("  SD   (Serial Data)  -> GPIO%d\n", I2S_SD);
  Serial.println("-----------------------------------------");

  initI2S();
  Serial.println("Driver I2S initializat. Incepe citirea datelor...");
}

// Variabile pentru calculul amplitudinii pe un interval de timp
unsigned long lastPrintTime = 0;
int32_t maxVal = -32768;
int32_t minVal = 32767;

void loop() {
  size_t bytes_read = 0;
  
  // Citim un calup de date de la perifericul I2S (blocant pana se umple bufferul)
  i2s_read(I2S_PORT, &i2s_raw_buffer, sizeof(i2s_raw_buffer), &bytes_read, portMAX_DELAY);
  
  int samples_read = bytes_read / 4; // Fiecare esantion are 4 octeti (32 biti)

  for (int i = 0; i < samples_read; i++) {
    // Conversie la 16 biti: deplasam la dreapta cu 14 biti pentru a aduce semnalul intr-un
    // interval util de int16_t si pentru a aplica o pre-amplificare naturala.
    int16_t sample = (int16_t)(i2s_raw_buffer[i] >> 14);
    
    if (sample > maxVal) maxVal = sample;
    if (sample < minVal) minVal = sample;
  }

  // Afisam nivelul de zgomot/sunet detectat la fiecare 50 de milisecunde
  if (millis() - lastPrintTime >= 50) {
    int32_t peakToPeak = maxVal - minVal;
    
    // Resetam valorile maxime si minime pentru urmatorul interval
    maxVal = -32768;
    minVal = 32767;
    lastPrintTime = millis();

    // Desenam VU-metrul ASCII in functie de intensitatea sunetului
    // 60 de caractere latime maxima. Scalam valoarea peak-to-peak la aceasta latime.
    int maxDisplayBarWidth = 60;
    int barWidth = peakToPeak / 100; // Factor de scalare pentru sensibilitate
    if (barWidth > maxDisplayBarWidth) barWidth = maxDisplayBarWidth;
    if (barWidth < 0) barWidth = 0;

    Serial.print("[");
    for (int i = 0; i < maxDisplayBarWidth; i++) {
      if (i < barWidth) {
        Serial.print("#");
      } else {
        Serial.print(" ");
      }
    }
    Serial.printf("] Amplitudine: %d\n", peakToPeak);
  }
}
