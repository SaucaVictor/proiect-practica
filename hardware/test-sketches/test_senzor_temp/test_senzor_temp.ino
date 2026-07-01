// Necesita librariile din Arduino Library Manager:
//   1. "DHT sensor library" de Adafruit
//   2. "Adafruit Unified Sensor" (dependenta necesara pentru prima)
#include <DHT.h>

// Definim pinul senzorului DHT11 conform BOM:
// DHT11 DATA -> GPIO16
#define DHTPIN 16     
#define DHTTYPE DHT11 // Tipul senzorului folosit (DHT11)

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  // Serial baud rate setat la 115200 pentru consistenta cu restul schitelor
  Serial.begin(115200);
  dht.begin();
  Serial.println("Test senzor DHT11 inceput...");
}

void loop() {
  // Citim temperatura (Celsius) si umiditatea (%)
  float temp = dht.readTemperature();
  float umid = dht.readHumidity();

  // Verificam daca citirea a reusit
  if (isnan(temp) || isnan(umid)) {
    Serial.println("Eroare: Nu s-au putut citi datele de la senzorul DHT11!");
  } else {
    Serial.print("Temperatura: ");
    Serial.print(temp, 1); // 1 zecimala
    Serial.print(" °C  |  Umiditate: ");
    Serial.print(umid, 1);
    Serial.println(" %");
  }

  // DHT11 este un senzor lent — se recomanda minim 2 secunde intre citiri
  delay(2000); 
}
