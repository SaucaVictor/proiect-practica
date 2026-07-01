import { ref, watch, onUnmounted, type Ref } from "vue";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export interface Reading {
  value: number;
  timestamp: any;
}

export function useHistoricalReadings(sensorName: string, period: Ref<string>) {
  const readings = ref<Reading[]>([]);      // downsampled — for chart rendering
  const rawReadings = ref<Reading[]>([]);   // full dataset — for CSV export
  const loading = ref(false);
  const stats = ref({ min: 0, max: 0, avg: 0 });

  let unsub: (() => void) | null = null;

  function load() {
    loading.value = true;
    if (unsub) { unsub(); unsub = null; }

    const colRef = collection(db, "sensors", sensorName, "readings");
    let q;

    if (period.value === "1h") {
      q = query(colRef, orderBy("timestamp", "desc"), limit(250));
    } else if (period.value === "6h") {
      q = query(colRef, orderBy("timestamp", "desc"), limit(750));
    } else if (period.value === "24h") {
      q = query(colRef, orderBy("timestamp", "desc"), limit(1800));
    } else if (period.value === "7d") {
      q = query(colRef, orderBy("timestamp", "desc"), limit(3500));
    } else {
      q = query(colRef, orderBy("timestamp", "desc"), limit(5000));
    }

    unsub = onSnapshot(q, (snap) => {
      let rawData = snap.docs.map((d) => d.data() as Reading);

      // Reverse from descending to chronological order
      rawData.reverse();

      // Filter invalid entries
      rawData = rawData.filter(
        (r) => r.timestamp && r.value !== undefined && !isNaN(r.value)
      );

      if (rawData.length > 0) {
        const values = rawData.map((r) => r.value);
        stats.value = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
        };
      } else {
        stats.value = { min: 0, max: 0, avg: 0 };
      }

      rawReadings.value = rawData;              // full dataset for export
      readings.value = downsample(rawData, 150); // downsampled for chart
      loading.value = false;
    }, (err) => {
      console.error(`[${sensorName}] snapshot error:`, err);
      loading.value = false;
    });
  }

  function downsample(data: Reading[], maxPoints: number): Reading[] {
    if (data.length <= maxPoints) return data;
    const result: Reading[] = [];
    const step = data.length / maxPoints;
    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.floor(i * step);
      if (data[idx]) result.push(data[idx]);
    }
    return result;
  }

  watch(period, load, { immediate: true });

  onUnmounted(() => { if (unsub) unsub(); });

  return { readings, rawReadings, stats, loading };
}
