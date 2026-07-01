import { ref, watch, onUnmounted, type Ref } from "vue";
import { supabase } from "@/services/supabase/client";
import { wrapTimestamp } from "./utils";

export interface Reading {
  value: number;
  timestamp: { toDate: () => Date } | null;
}

export function useHistoricalReadings(sensorName: string, period: Ref<string>) {
  const readings = ref<Reading[]>([]);
  const rawReadings = ref<Reading[]>([]);
  const loading = ref(false);
  const stats = ref({ min: 0, max: 0, avg: 0 });

  let channel: any = null;

  async function load() {
    loading.value = true;

    let limit = 250;
    let cutoffDate = new Date();

    if (period.value === "1h") {
      limit = 250;
      cutoffDate.setHours(cutoffDate.getHours() - 1);
    } else if (period.value === "6h") {
      limit = 750;
      cutoffDate.setHours(cutoffDate.getHours() - 6);
    } else if (period.value === "24h") {
      limit = 1800;
      cutoffDate.setDate(cutoffDate.getDate() - 1);
    } else if (period.value === "7d") {
      limit = 3500;
      cutoffDate.setDate(cutoffDate.getDate() - 7);
    } else {
      limit = 5000;
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    }

    const { data, error } = await supabase
      .from("iot_sensor_readings")
      .select("value, timestamp")
      .eq("sensor_name", sensorName)
      .gte("timestamp", cutoffDate.toISOString())
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Error loading historical readings for ${sensorName}:`, error);
      loading.value = false;
      return;
    }

    if (data) {
      let rawData = data.map((r) => ({
        value: Number(r.value),
        timestamp: wrapTimestamp(r.timestamp),
      })).reverse();

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

      rawReadings.value = rawData;
      readings.value = downsample(rawData, 150);
    }

    loading.value = false;
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

  channel = supabase
    .channel(`iot-historical-${sensorName}-${Math.random()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "iot_sensor_readings",
        filter: `sensor_name=eq.${sensorName}`,
      },
      () => {
        load();
      }
    )
    .subscribe();

  onUnmounted(() => {
    if (channel) supabase.removeChannel(channel);
  });

  return { readings, rawReadings, stats, loading };
}
