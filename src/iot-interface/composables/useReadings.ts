import { ref, onUnmounted } from "vue";
import { supabase } from "@/services/supabase/client";
import { wrapTimestamp } from "./utils";

export interface Reading {
  value: number;
  timestamp: { toDate: () => Date } | null;
}

export function useReadings(sensorName: string, count = 40) {
  const readings = ref<Reading[]>([]);

  async function fetchReadings() {
    const { data, error } = await supabase
      .from("iot_sensor_readings")
      .select("value, timestamp")
      .eq("sensor_name", sensorName)
      .order("timestamp", { ascending: false })
      .limit(count);

    if (error) {
      console.error(`Error fetching readings for ${sensorName}:`, error);
      return;
    }
    if (data) {
      readings.value = data.map((r) => ({
        value: Number(r.value),
        timestamp: wrapTimestamp(r.timestamp),
      })).reverse();
    }
  }

  fetchReadings();

  const channel = supabase
    .channel(`iot-readings-${sensorName}-${Math.random()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "iot_sensor_readings",
        filter: `sensor_name=eq.${sensorName}`,
      },
      (payload) => {
        const newRow = payload.new as any;
        if (newRow) {
          readings.value.push({
            value: Number(newRow.value),
            timestamp: wrapTimestamp(newRow.timestamp),
          });
          if (readings.value.length > count) {
            readings.value.shift();
          }
        }
      }
    )
    .subscribe();

  onUnmounted(() => {
    supabase.removeChannel(channel);
  });

  return { readings };
}
