import { ref, onUnmounted } from "vue";
import { doc, onSnapshot, setDoc, addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";

export interface Settings {
  fan: number; led: number; ptc: number;
  display: string;
  mode: "manual" | "auto";
  thermostatTarget: number;
}

export function useSettings() {
  const settings = ref<Settings>({ fan: 0, led: 0, ptc: 0, display: "All", mode: "manual", thermostatTarget: 22 });

  const unsub = onSnapshot(doc(db, "settings", "1"), (snap) => {
    if (snap.exists()) settings.value = snap.data() as Settings;
  });

  onUnmounted(unsub);

  async function updateSettings(updates: Partial<Settings>) {
    await setDoc(doc(db, "settings", "1"), updates, { merge: true });
  }

  async function sendCommand(message: string) {
    await addDoc(collection(db, "commands"), {
      message,
      sentAt: new Date(),
    });
  }

  return { settings, updateSettings, sendCommand };
}
