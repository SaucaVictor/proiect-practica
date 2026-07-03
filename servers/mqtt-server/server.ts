import mqtt from "mqtt";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// ─── CUSTOM PARSER PENTRU FIȘIERUL .ENV ───
// Nu necesita pachete externe de tip 'dotenv'
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const separatorIdx = trimmed.indexOf("=");
        if (separatorIdx !== -1) {
          const key = trimmed.substring(0, separatorIdx).trim();
          const val = trimmed.substring(separatorIdx + 1).trim();
          process.env[key] = val;
        }
      }
    }
  }
}

// Incarcam variabilele de mediu din fisierul .env
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ EROARE: Credentialele Supabase lipsesc din .env!");
  process.exit(1);
}

// Initializam clientul de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// ─── CONFIGURARE INTERFEȚE ȘI TIPURI ───
interface SensorValues { Light: number; Temperature: number; Persons: number; Curent: number; }
interface Condition { sensor: string; operator: string; value: number; unit: string; }
interface ScenarioAction { output: "fan" | "led" | "ptc"; value: number; }
interface ScenarioData {
  id: string; name: string; enabled: boolean; type: string;
  conditions: Condition[]; actions: ScenarioAction[];
  thermostatTarget?: number; deadband?: number; maxRange?: number;
  highThreshold?: number; lowThreshold?: number;
  midBrightness?: number; fullBrightness?: number; offDelay?: number;
}

// Harta pini conform BOM / Firmware
const PIN: Record<string, number> = { fan: 25, led: 26, ptc: 17 };

// Conectare la Brokerul MQTT public (acelasi folosit in codul Wemos)
const client = mqtt.connect("mqtt://broker.hivemq.com");

// TOPIC-uri sincronizate cu codul Arduino nou
const TELEMETRY_TOPIC = "iot/classmonitor/telemetry"; // Subscrie pentru a primi datele de la Wemos
const CONTROL_TOPIC   = "iot/classmonitor/control";   // Publica comenzile catre Wemos

let isDeviceConnected = false;
let currentMode: "manual" | "auto" = "manual";
let thermostatTarget = 22;
let scenarios: ScenarioData[] = [];
let lastSensorValues: SensorValues = { Light: 0, Temperature: 20, Persons: 0, Curent: 0 };
let prevPersons = 0;
let roomEmptiedTime: number | null = null;
const lastSentAuto: Record<string, number | null> = { fan: null, led: null, ptc: null };

function mapRange(v: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  return Math.max(outMin, Math.min(outMax, ((v - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin));
}

// Trimite comenzi catre ESP32 prin topicul dedicat de control
function sendMQTT(message: string) {
  client.publish(CONTROL_TOPIC, message);
  console.log(`📤 [MQTT] Trimis comanda: ${message}`);
}

// ─── LOGICĂ EVALUARE REGULI ȘI SCENARII AUTOMATE ───

function evalCondition(c: Condition, sensors: SensorValues): boolean {
  let raw = sensors[c.sensor as keyof SensorValues] ?? 0;
  // Daca senzorul este lumina si unitatea este %, mapam pragul de la 0-100 la 0-1023
  const threshold = c.unit === "percent" && c.sensor === "Light" ? c.value * 10.23 : c.value;
  switch (c.operator) {
    case ">":  return raw > threshold;
    case "<":  return raw < threshold;
    case ">=": return raw >= threshold;
    case "<=": return raw <= threshold;
    case "==": return raw === threshold;
    case "!=": return raw !== threshold;
    default:   return false;
  }
}

function evaluateLightControl(s: ScenarioData): number {
  const highThreshold  = s.highThreshold  ?? 75;
  const lowThreshold   = s.lowThreshold   ?? 25;
  const midBrightness  = Math.round((s.midBrightness  ?? 70)  / 100 * 255);
  const fullBrightness = Math.round((s.fullBrightness ?? 100) / 100 * 255);

  const lightPct = (lastSensorValues.Light / 1023) * 100;
  const persons  = lastSensorValues.Persons;

  if (lightPct > highThreshold) {
    return 0; // Prea multa lumina naturala, oprim banda LED
  }

  const brightness = lightPct < lowThreshold ? fullBrightness : midBrightness;

  if (persons > 0) {
    return brightness;
  } else {
    // Daca nu sunt persoane, oprim banda dupa delay-ul configurat
    if (roomEmptiedTime !== null) {
      const elapsed = Date.now() - roomEmptiedTime;
      const offDelayMs = (s.offDelay ?? 10) * 1000;
      if (elapsed < offDelayMs) {
        return brightness;
      }
    }
    return 0;
  }
}

function evaluateTempControl(s: ScenarioData): { fan: number; ptc: number } {
  const target   = s.thermostatTarget ?? thermostatTarget;
  const deadband = s.deadband ?? 0.5;
  const maxRange = s.maxRange ?? 10;

  const ECO_CAP = Math.round(0.7 * 255); // Reducere la 70% putere maxima daca sunt putine persoane

  const diff    = lastSensorValues.Temperature - target;
  const persons = lastSensorValues.Persons;

  if (persons === 0) return { fan: 0, ptc: 0 }; // Sala goala, oprim ventilarea/incalzirea

  let fan = 0;
  let ptc = 0;

  if (diff > deadband) {
    // Prea cald -> pornim ventilatoarele
    fan = Math.round(mapRange(diff, deadband, maxRange, 30, 255));
    ptc = 0;
  } else if (diff < -deadband) {
    // Prea frig -> pornim PTC-ul
    ptc = Math.round(mapRange(-diff, deadband, maxRange, 30, 255));
    fan = 0;
  }

  // Mod ECO daca in sala sunt putini studenti (<= 9)
  if (persons <= 9) {
    fan = Math.min(fan, ECO_CAP);
    ptc = Math.min(ptc, ECO_CAP);
  }

  return { fan, ptc };
}

function evaluateScenarios() {
  const persons = lastSensorValues.Persons;
  const prev = prevPersons;
  
  if (persons > 0) {
    roomEmptiedTime = null;
  } else if (persons === 0 && prev > 0) {
    roomEmptiedTime = Date.now();
  }

  const currentTargets: Record<string, number> = { fan: 0, led: 0, ptc: 0 };
  const hasProposals: Record<string, boolean> = { fan: false, led: false, ptc: false };

  // 1. Evaluam scenariile predefinite (Light Control si Temp Control)
  for (const s of scenarios.filter(x => x.enabled)) {
    if (s.type === "light_control") {
      currentTargets.led = evaluateLightControl(s);
      hasProposals.led = true;
    } else if (s.type === "temperature_control") {
      const res = evaluateTempControl(s);
      currentTargets.fan = res.fan;
      currentTargets.ptc = res.ptc;
      hasProposals.fan = true;
      hasProposals.ptc = true;
    }
  }

  // 2. Evaluam scenariile simple bazate pe reguli custom (consecutiv AND)
  for (const s of scenarios.filter(x => x.enabled && x.type === "simple")) {
    const pass = (s.conditions ?? []).every(c => evalCondition(c, lastSensorValues));
    if (pass) {
      for (const a of (s.actions ?? [])) {
        currentTargets[a.output] = a.value;
        hasProposals[a.output] = true;
      }
    }
  }

  const outputs: Array<"fan" | "led" | "ptc"> = ["fan", "led", "ptc"];
  const updates: Record<string, number> = {};
  let hasUpdates = false;

  for (const out of outputs) {
    const targetVal = Math.round(currentTargets[out]);
    if (lastSentAuto[out] !== targetVal) {
      lastSentAuto[out] = targetVal;
      sendMQTT(`CMD;${PIN[out]}:${targetVal}`);
      updates[out] = targetVal;
      hasUpdates = true;
    }
  }

  // Salvam starile noi in baza de date Supabase (iot_settings)
  if (hasUpdates) {
    supabase
      .from("iot_settings")
      .update(updates)
      .eq("id", "1")
      .then(({ error }) => {
        if (error) console.error("❌ Eroare la actualizarea iot_settings in Supabase:", error);
      });
  }

  prevPersons = persons;
}

// ─── INITIALIZARE CONTEXT ȘI CONECTARE LA SUPABASE REALTIME ───

async function initializeState() {
  console.log("🔋 Incarcare configuratii initiale...");
  
  // 1. Incarcare iot_settings
  const { data: settingsData, error: settingsError } = await supabase
    .from("iot_settings")
    .select("*")
    .eq("id", "1")
    .single();

  if (settingsError) {
    console.error("❌ Nu s-au putut incarca setarile din Supabase:", settingsError);
  } else if (settingsData) {
    currentMode = settingsData.mode as "manual" | "auto";
    thermostatTarget = Number(settingsData.thermostat_target);
    console.log(`⚙️ Configuri incarcate: Mod = ${currentMode}, Termostat = ${thermostatTarget}°C`);
  }

  // 2. Incarcare scenarii
  await reloadScenarios();

  // 3. Subscriere la modificarile din tabela public.iot_settings (UPDATE pe ID '1')
  supabase
    .channel("iot_settings_changes")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "iot_settings", filter: "id=eq.1" },
      (payload) => {
        const d = payload.new;
        
        if (d.mode !== undefined) {
          const prevMode = currentMode;
          currentMode = d.mode as "manual" | "auto";
          console.log(`🔄 Schimbare mod → ${currentMode}`);
          if (currentMode === "auto" && prevMode === "manual") {
            lastSentAuto.fan = null;
            lastSentAuto.led = null;
            lastSentAuto.ptc = null;
            evaluateScenarios();
          }
        }
        
        if (d.thermostat_target !== undefined) {
          thermostatTarget = Number(d.thermostat_target);
        }

        if (!isDeviceConnected) return;
        
        // Daca ecranul a fost schimbat din site, trimitem comanda pe Wemos
        if (d.display !== undefined) {
          sendMQTT(`CMD;LCD:${d.display}`);
        }
        
        // Daca suntem in mod manual, scriem direct comenzile pe hardware
        if (currentMode === "manual") {
          if (d.fan !== undefined) sendMQTT(`CMD;${PIN.fan}:${d.fan}`);
          if (d.led !== undefined) sendMQTT(`CMD;${PIN.led}:${d.led}`);
          if (d.ptc !== undefined) sendMQTT(`CMD;${PIN.ptc}:${d.ptc}`);
        }
      }
    )
    .subscribe();

  // 4. Subscriere la tabela public.iot_scenarios (orice eveniment)
  supabase
    .channel("iot_scenarios_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "iot_scenarios" },
      async () => {
        console.log("📋 Scenariile au fost modificate in baza de date, reincarcare...");
        await reloadScenarios();
      }
    )
    .subscribe();

  // 5. Subscriere la tabela public.iot_commands (INSERT)
  // site-ul poate trimite comenzi brute inserand in aceasta tabela
  supabase
    .channel("iot_commands_changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "iot_commands" },
      (payload) => {
        if (!isDeviceConnected) return;
        const msg = payload.new.message;
        if (msg) {
          sendMQTT(msg);
          console.log(`📤 Comanda primita din Supabase (iot_commands): ${msg}`);
        }
      }
    )
    .subscribe();
}

async function reloadScenarios() {
  const { data, error } = await supabase.from("iot_scenarios").select("*");
  if (error) {
    console.error("❌ Eroare la incarcarea scenariilor:", error);
    return;
  }
  if (data) {
    scenarios = data.map(s => ({
      id: s.id,
      name: s.name,
      enabled: s.enabled,
      type: s.type,
      conditions: s.conditions,
      actions: s.actions,
      thermostatTarget: s.thermostat_target ? Number(s.thermostat_target) : undefined,
      deadband: s.deadband ? Number(s.deadband) : undefined,
      maxRange: s.max_range ? Number(s.max_range) : undefined,
      highThreshold: s.high_threshold ? Number(s.high_threshold) : undefined,
      lowThreshold: s.low_threshold ? Number(s.low_threshold) : undefined,
      midBrightness: s.mid_brightness ? Number(s.mid_brightness) : undefined,
      fullBrightness: s.full_brightness ? Number(s.full_brightness) : undefined,
      offDelay: s.off_delay ? Number(s.off_delay) : undefined
    }));
    console.log(`📋 Total scenarii incarcate: ${scenarios.length}`);
  }
}

// ─── LOGICĂ COMUNICARE MQTT (RECEPȚIE DATE SENZORI) ───

const TRACKED = new Set(["Persons", "Temperature", "Light", "Curent"]);

client.on("connect", () => {
  console.log(`🚀 Conectat la Brokerul MQTT | Ascult pe topicul: ${TELEMETRY_TOPIC}`);
  client.subscribe(TELEMETRY_TOPIC, (err) => {
    if (err) console.error("❌ Eroare la abonare topic MQTT:", err);
  });
});

client.on("message", async (topic, payload) => {
  if (topic !== TELEMETRY_TOPIC) return;
  
  isDeviceConnected = true;
  const message = payload.toString();
  console.log(`📩 [MQTT] Primit: ${message}`);

  let deviceIp = "192.168.0.100"; // IP default de siguranta
  const sensorsToUpsert: any[] = [];
  const readingsToInsert: any[] = [];

  // Parsam string-ul de telemetrie de la Wemos (Format: "Cheie:Valoare;Cheie2:Valoare2")
  const pairs = message.split(";");
  const parsedMap: Record<string, string> = {};

  for (const pair of pairs) {
    const ci = pair.indexOf(":");
    if (ci === -1) continue;
    const name  = pair.substring(0, ci).trim();
    const value = pair.substring(ci + 1).trim();
    if (!name || !value) continue;

    if (name === "IP") {
      deviceIp = value;
    } else {
      parsedMap[name] = value;
    }
  }

  // Adaugam Wemos in tabela de dispozitive active
  await supabase
    .from("iot_devices")
    .upsert({ id: "wemos", address: deviceIp, last_seen: new Date(), online: true });

  // Pregatim scrierea compacta (batch/bulks) in Supabase
  for (const [name, value] of Object.entries(parsedMap)) {
    const parsedVal = parseFloat(value);
    
    // Tabela public.iot_sensors (starea curenta)
    sensorsToUpsert.push({
      name: name,
      latest_value: value,
      last_updated: new Date(),
      device_ip: deviceIp
    });

    // Tabela public.iot_sensor_readings (istoric masuratori)
    if (TRACKED.has(name) && !isNaN(parsedVal)) {
      lastSensorValues[name as keyof SensorValues] = parsedVal;
      readingsToInsert.push({
        sensor_name: name,
        value: parsedVal,
        timestamp: new Date(),
        device_ip: deviceIp
      });
    }
  }

  // Scriem toate datele intrun singur query compact (satisfacand restrictia de 1-2 secunde per write)
  if (sensorsToUpsert.length > 0) {
    const { error } = await supabase.from("iot_sensors").upsert(sensorsToUpsert);
    if (error) console.error("❌ Eroare la scrierea senzorilor in Supabase:", error);
  }

  if (readingsToInsert.length > 0) {
    const { error } = await supabase.from("iot_sensor_readings").insert(readingsToInsert);
    if (error) console.error("❌ Eroare la scrierea istoricului in Supabase:", error);
  }

  // Daca modul este auto, evaluam scenariile dupa noile date
  if (currentMode === "auto") {
    evaluateScenarios();
  }
});

client.on("error", (err) => {
  console.error("❌ Eroare client MQTT:", err);
});

// Pornim initializarea
initializeState().catch(err => {
  console.error("❌ Eroare pornire server:", err);
});
