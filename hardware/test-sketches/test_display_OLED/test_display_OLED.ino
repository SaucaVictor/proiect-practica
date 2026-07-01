// Necesita librariile din Arduino Library Manager:
//   1. "Adafruit SSD1306" de Adafruit
//   2. "Adafruit GFX Library" de Adafruit
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET     -1 

// Definim pinii I2C conform BOM pentru Wemos D1 R32 / ESP32
#define I2C_SDA 21
#define I2C_SCL 22

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup() {
  // Pornim comunicarea seriala la 115200
  Serial.begin(115200);
  Serial.println("Initializare ecran OLED...");

  // Initializam I2C cu pinii dedicati ESP32 (GPIO21 - SDA, GPIO22 - SCL)
  Wire.begin(I2C_SDA, I2C_SCL); 

  // Adresa I2C standard pentru ecranul OLED 0.96" este 0x3C
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println(F("Eroare: Ecranul OLED SSD1306 nu a putut fi gasit! Verificati cablajul (SDA/SCL/Alimentare)."));
    for(;;); // Blocam executia daca ecranul lipseste
  }

  Serial.println("Ecran OLED initializat cu succes.");

  // Afisam textul pe ecran
  display.clearDisplay();
  display.setTextSize(1);      
  display.setTextColor(SSD1306_WHITE);          
  display.setCursor(20, 25);             
  display.println(F("CONEXIUNE OK!"));
  display.display();
}

void loop() {}
