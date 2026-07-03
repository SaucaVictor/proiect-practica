# Test Sketches — ClassMonitor

Acest director conține coduri și schițe Arduino (.ino) folosite pentru testarea individuală a componentelor hardware și senzorilor înainte de integrarea lor în firmware-ul final.

## Structură recomandată pentru teste

Creați câte un sub-director pentru fiecare componentă testată:

```
test-sketches/
├── test_senzor_temp/
│   └── test_senzor_temp.ino
├── test_counter_persoane/
│   └── test_counter_persoane.ino
├── test_pwm_led/
│   └── test_pwm_led.ino
├── test_display_OLED/
│   └── test_display_OLED.ino
├── test_senzor_curent/
│   └── test_senzor_curent.ino
├── test_senzor_lumina/
│   └── test_senzor_lumina.ino
├── test_microfon_websocket/
│   └── test_microfon_websocket.ino
├── test_microfon_offline/
│   └── test_microfon_offline.ino
├── test_buton_extern/
│   └── test_buton_extern.ino
```

## Reguli de dezvoltare pentru teste
1. **Cod simplu:** Păstrați schițele cât mai aerisite — doar citirea senzorului și afișarea în `Serial Monitor`.
2. **Documentare pini:** Specificați clar în comentariile de la începutul fișierului ce pini folosiți (corelați cu pinii din [BOM.md](../BOM.md)).
3. **Librării folosite:** Menționați în comentarii ce librărie externă a fost folosită (ex: Adafruit DHT, U8g2 etc.).
