#include <DHT.h>

#define DHTPIN 2    // Pin DHT11
#define DHTTYPE DHT11  // Tipul senzorului

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  float temp = dht.readTemperature();

  if (isnan(temp)) {
    Serial.println("Temp: eroare citire DHT");
  } else {
    Serial.print("Temp: ");
    Serial.print(temp);
    Serial.println(" C");
  }

  delay(1000);
}