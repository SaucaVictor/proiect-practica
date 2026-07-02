import { ref, onUnmounted } from "vue";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export interface Condition {
  sensor: string;       // "Light" | "Temperature" | "Persons" | "Curent"
  operator: string;     // ">" | "<" | ">=" | "<=" | "==" | "!="
  value: number;
  unit: string;         // "raw" | "percent"
}

export interface ScenarioAction {
  output: "fan" | "led" | "ptc";
  value: number;        // 0-255
}

export interface Scenario {
  id: string;
  name: string;
  enabled: boolean;
  type: "simple" | "light_control" | "temperature_control";
  conditions: Condition[];
  actions: ScenarioAction[];
  createdAt?: any;
  // Temperature control
  thermostatTarget?: number;
  deadband?: number;
  maxRange?: number;

  // Light control
  highThreshold?: number;
  lowThreshold?: number;
  midBrightness?: number;
  fullBrightness?: number;
  offDelay?: number;
}

export function useScenarios() {
  const scenarios = ref<Scenario[]>([]);

  const unsub = onSnapshot(collection(db, "scenarios"), (snap) => {
    scenarios.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Scenario));
  });
  onUnmounted(unsub);

  async function addScenario(s: Omit<Scenario, "id">) {
    await addDoc(collection(db, "scenarios"), { ...s, createdAt: serverTimestamp() });
  }

  async function updateScenario(id: string, updates: Partial<Scenario>) {
    await updateDoc(doc(db, "scenarios", id), updates);
  }

  async function deleteScenario(id: string) {
    await deleteDoc(doc(db, "scenarios", id));
  }

  async function toggleScenario(id: string, enabled: boolean) {
    await updateDoc(doc(db, "scenarios", id), { enabled });
  }

  async function seedDefaults() {
    const snap = await getDocs(collection(db, "scenarios"));
    const types = snap.docs.map(d => d.data().type as string);

    if (!types.includes("light_control")) {
      await addDoc(collection(db, "scenarios"), {
        name: "Light Control",
        enabled: false,
        type: "light_control",
        conditions: [],
        actions: [],
        createdAt: serverTimestamp(),
      });
    }
    if (!types.includes("temperature_control")) {
      await addDoc(collection(db, "scenarios"), {
        name: "Temperature Control",
        enabled: false,
        type: "temperature_control",
        conditions: [],
        actions: [],
        thermostatTarget: 22,
        createdAt: serverTimestamp(),
      });
    }
  }

  return { scenarios, addScenario, updateScenario, deleteScenario, toggleScenario, seedDefaults };
}
