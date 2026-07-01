import { ref, onUnmounted } from "vue";
import { supabase } from "@/services/supabase/client";
import { wrapTimestamp } from "./utils";

export interface DeviceInfo {
  address: string;
  port: number;
  lastSeen: { toDate: () => Date } | null;
  online: boolean;
}

export function useDevice() {
  const device = ref<DeviceInfo | null>(null);

  async function fetchDevice() {
    const { data, error } = await supabase
      .from("iot_devices")
      .select("*")
      .eq("id", "wemos")
      .maybeSingle();
      
    if (error) {
      console.error("Error fetching device status:", error);
      return;
    }
    if (data) {
      device.value = {
        address: data.address,
        port: 1883,
        lastSeen: wrapTimestamp(data.last_seen),
        online: data.online,
      };
    }
  }

  fetchDevice();

  const channel = supabase
    .channel(`iot-devices-realtime-${Math.random()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "iot_devices", filter: "id=eq.wemos" },
      (payload) => {
        const newRow = payload.new as any;
        if (newRow) {
          device.value = {
            address: newRow.address,
            port: 1883,
            lastSeen: wrapTimestamp(newRow.last_seen),
            online: newRow.online,
          };
        } else {
          device.value = null;
        }
      }
    )
    .subscribe();

  onUnmounted(() => {
    supabase.removeChannel(channel);
  });

  return { device };
}
