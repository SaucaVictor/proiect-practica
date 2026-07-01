import { ref, onUnmounted } from "vue";
import { supabase } from "@/services/supabase/client";

export interface SensorData {
  latestValue: string;
  lastUpdated: any;
  deviceIp: string;
}

export function useSensors() {
  const sensors = ref<Record<string, SensorData>>({});

  async function fetchSensors() {
    const { data, error } = await supabase
      .from("iot_sensors")
      .select("*");
    if (error) {
      console.error("Error fetching sensors:", error);
      return;
    }
    if (data) {
      data.forEach((row) => {
        sensors.value[row.name] = {
          latestValue: row.latest_value,
          lastUpdated: row.last_updated,
          deviceIp: row.device_ip,
        };
      });
    }
  }

  fetchSensors();

  const channel = supabase
    .channel(`iot-sensors-realtime-${Math.random()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "iot_sensors" },
      (payload) => {
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        
        if (payload.eventType === "DELETE" && oldRow) {
          delete sensors.value[oldRow.name];
        } else if (newRow) {
          sensors.value[newRow.name] = {
            latestValue: newRow.latest_value,
            lastUpdated: newRow.last_updated,
            deviceIp: newRow.device_ip,
          };
        }
      }
    )
    .subscribe();

  onUnmounted(() => {
    supabase.removeChannel(channel);
  });

  return { sensors };
}
