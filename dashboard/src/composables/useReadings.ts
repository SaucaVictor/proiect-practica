import { ref, onUnmounted } from "vue";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";

export interface Reading {
  value: number;
  timestamp: { toDate: () => Date } | null;
}

export function useReadings(sensorName: string, count = 40) {
  const readings = ref<Reading[]>([]);

  const q = query(
    collection(db, "sensors", sensorName, "readings"),
    orderBy("timestamp", "desc"),
    limit(count)
  );

  const unsub = onSnapshot(q, (snap) => {
    readings.value = snap.docs
      .map((d) => d.data() as Reading)
      .reverse(); // oldest → newest for the chart
  });

  onUnmounted(unsub);
  return { readings };
}
