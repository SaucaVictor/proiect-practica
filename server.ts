import mqtt from "mqtt";
import { db } from "./firebase";
import { doc, setDoc, addDoc, collection, serverTimestamp, onSnapshot } from "firebase/firestore";

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

const PIN: Record<string, number> = { fan: 25, led: 26, ptc: 17 };

const client = mqtt.connect("mqtt://broker.hivemq.com");
const SENSORS_TOPIC = "classroom/sauca/sensors";
const COMMANDS_TOPIC = "classroom/sauca/commands";

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

function sendMQTT(message: string) {
  client.publish(COMMANDS_TOPIC, message);
  console.log(`📤 [MQTT] ${message}`);
}

function evalCondition(c: Condition, sensors: SensorValues): boolean {
  let raw = sensors[c.sensor as keyof SensorValues] ?? 0;
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
    return 0;
  }

  const brightness = lightPct < lowThreshold ? fullBrightness : midBrightness;

  if (persons > 0) {
    return brightness;
  } else {
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

  const ECO_CAP = Math.round(0.7 * 255);

  const diff    = lastSensorValues.Temperature - target;
  const persons = lastSensorValues.Persons;

  if (persons === 0) return { fan: 0, ptc: 0 };

  let fan = 0;
  let ptc = 0;

  if (diff > deadband) {
    fan = Math.round(mapRange(diff, deadband, maxRange, 30, 255));
    ptc = 0;
  } else if (diff < -deadband) {
    ptc = Math.round(mapRange(-diff, deadband, maxRange, 30, 255));
    fan = 0;
  }

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

  if (hasUpdates) {
    setDoc(doc(db, "settings", "1"), updates, { merge: true }).catch(err => {
      console.error("Failed to update settings in Firestore:", err);
    });
  }

  prevPersons = persons;
}

onSnapshot(doc(db, "settings", "1"), (snap) => {
  if (!snap.exists()) return;
  const d = snap.data();
  if (d.mode !== undefined) {
    const prevMode = currentMode;
    currentMode = d.mode;
    console.log(`🔄 Mode → ${currentMode}`);
    if (currentMode === "auto" && prevMode === "manual") {
      lastSentAuto.fan = null;
      lastSentAuto.led = null;
      lastSentAuto.ptc = null;
      evaluateScenarios();
    }
  }
  if (d.thermostatTarget !== undefined)   thermostatTarget = d.thermostatTarget;

  if (!isDeviceConnected) return;
  if (d.display !== undefined) sendMQTT(`CMD;LCD:${d.display}`);
  if (currentMode === "manual") {
    if (d.fan !== undefined) sendMQTT(`CMD;${PIN.fan}:${d.fan}`);
    if (d.led !== undefined) sendMQTT(`CMD;${PIN.led}:${d.led}`);
    if (d.ptc !== undefined) sendMQTT(`CMD;${PIN.ptc}:${d.ptc}`);
  }
});

onSnapshot(collection(db, "scenarios"), (snap) => {
  scenarios = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ScenarioData[];
  console.log(`📋 Loaded ${scenarios.length} scenarios`);
});

let commandsInitialized = false;
onSnapshot(collection(db, "commands"), (snap) => {
  if (!commandsInitialized) { commandsInitialized = true; return; }
  snap.docChanges().forEach(change => {
    if (change.type === "added" && isDeviceConnected) {
      const { message } = change.doc.data();
      if (message) { sendMQTT(message); console.log(`📤 Command: ${message}`); }
    }
  });
});

const TRACKED = new Set(["Persons", "Temperature", "Light", "Curent"]);

client.on("connect", () => {
  console.log(`🚀 Connected to MQTT Broker | Topic: ${SENSORS_TOPIC}`);
  client.subscribe(SENSORS_TOPIC, (err) => {
    if (err) console.error("MQTT subscription error:", err);
  });
});

client.on("message", async (topic, payload) => {
  if (topic !== SENSORS_TOPIC) return;
  
  isDeviceConnected = true;
  const message = payload.toString();
  console.log(`📩 [MQTT] ${message}`);

  let deviceIp = "192.168.0.176"; 

  setDoc(doc(db, "devices", "wemos"), {
    address: deviceIp,
    lastSeen: serverTimestamp(), online: true,
  }, { merge: true });

  for (const pair of message.split(";")) {
    const ci = pair.indexOf(":");
    if (ci === -1) continue;
    const name  = pair.substring(0, ci).trim();
    const value = pair.substring(ci + 1).trim();
    if (!name || !value) continue;

    if (name === "IP") {
      deviceIp = value;
      continue;
    }

    setDoc(doc(db, "sensors", name), {
      latestValue: value, lastUpdated: serverTimestamp(), deviceIp,
    }, { merge: true });

    if (TRACKED.has(name)) {
      lastSensorValues[name as keyof SensorValues] = parseFloat(value);
      addDoc(collection(db, "sensors", name, "readings"), {
        value: parseFloat(value), timestamp: serverTimestamp(), deviceIp,
      });
    }
  }

  if (currentMode === "auto") evaluateScenarios();
});

client.on("error", (err) => {
  console.error("MQTT Client Error:", err);
});
