import { ref, onUnmounted } from "vue";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export interface SensorData {
  latestValue: string;
  lastUpdated: { toDate: () => Date } | null;
  deviceIp: string;
}

export function useSensors() {
  const sensors = ref<Record<string, SensorData>>({});

  const unsub = onSnapshot(collection(db, "sensors"), (snap) => {
    const ids = new Set(snap.docs.map((d) => d.id));
    // Remove stale
    Object.keys(sensors.value).forEach((k) => { if (!ids.has(k)) delete sensors.value[k]; });
    // Upsert
    snap.forEach((d) => { sensors.value[d.id] = d.data() as SensorData; });
  });

  onUnmounted(unsub);
  return { sensors };
}
