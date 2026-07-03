# Hardware — ClassMonitor

Documentația hardware pentru sistemul de instrumentare sală de curs.

## Structură

```
hardware/
├── BOM.md              # Bill of Materials — lista completă de piese
├── schematic.fzz       # Schema Fritzing
├── schematic-preview.png  # Export PNG schemă
├── classmonitor_firmware/ # Firmware de bază (MQTT telemetrie, fără audio)
├── classmonitor_firmware_final/ # Firmware integrat final (MQTT telemetrie/comenzi + Audio)
├── test-sketches/      # Coduri Arduino (.ino) pentru testarea individuală a pieselor
├── photos/             # Poze machetă / montaj (de adăugat)
└── notes.md            # Note tehnice din testare
```

## Responsabil

**Tuțu Cristian, Bucura Ion-Bogdan** — hardware/embedded

## Resurse

- [BOM — Lista de piese](./BOM.md)
- Datasheet IR540N: https://www.infineon.com/dgdl/ir540npbf.pdf
- Datasheet ACS712: https://www.allegromicro.com/en/products/sense/current-linear/acs712
- INMP441 I2S guide: https://invensense.tdk.com/products/digital/inmp441/
