// Definim pinii senzorilor IR conform BOM:
// Senzor IR 1 (Intrare) -> GPIO5
// Senzor IR 2 (Iesire)  -> GPIO23
const int irPin1 = 5;  // IR sensor 1 (Intrare)
const int irPin2 = 23; // IR sensor 2 (Iesire)

int in_count = 0;        // Numar persoane intrate
int out_count = 0;       // Numar persoane iesite
int current_count = 0;   // Numar curent de persoane din sala

// Timp maxim de trecere intre senzori in milisecunde (fereastra de detectie)
const unsigned long timeout = 500; 

void setup() {
  // Serial baud rate crescut la 115200 pentru consistenta cu restul schitelor
  Serial.begin(115200);

  // Configuram pinii ca intrari cu pull-up intern activat
  pinMode(irPin1, INPUT_PULLUP);
  pinMode(irPin2, INPUT_PULLUP);

  Serial.println("Detector directie si contorizare persoane inceput...");
  Serial.println("IN: 0   OUT: 0   Current: 0");
}

void loop() {
  
  // LOGICA DETECTIE INTRARE (Senzor 1 activat primul)
  if (digitalRead(irPin1) == LOW) {
    unsigned long startTime = millis();
    while ((millis() - startTime) < timeout) {
      if (digitalRead(irPin2) == LOW) {
         in_count++;
         updateSerial();
         break;
      }
    }
    // Asteapta pana cand ambele bariere IR revin la starea normala (unblocked / HIGH)
    while (digitalRead(irPin1) == LOW || digitalRead(irPin2) == LOW) {
      delay(10); // delay scurt pentru stabilitate
    }
  }
  
  // LOGICA DETECTIE IESIRE (Senzor 2 activat primul)
  else if (digitalRead(irPin2) == LOW) {
    unsigned long startTime = millis();
    while ((millis() - startTime) < timeout) {
      if (digitalRead(irPin1) == LOW) {
        if (out_count < in_count) {
           out_count++;
           updateSerial();
           break;
        }
      }
    }
    // Asteapta pana cand ambele bariere IR revin la starea normala (unblocked / HIGH)
    while (digitalRead(irPin1) == LOW || digitalRead(irPin2) == LOW) {
      delay(10); // delay scurt pentru stabilitate
    }
  }
}

void updateSerial() {
  current_count = in_count - out_count;
  Serial.print("IN: ");
  Serial.print(in_count);
  Serial.print("   OUT: ");
  Serial.print(out_count);
  Serial.print("   Current: ");
  Serial.println(current_count);
}
