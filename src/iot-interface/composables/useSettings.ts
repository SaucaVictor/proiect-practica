import { ref, onUnmounted } from "vue";
import { supabase } from "@/services/supabase/client";

export interface Settings {
  fan: number;
  led: number;
  ptc: number;
  display: string;
  mode: "manual" | "auto";
  thermostatTarget: number;
}

export function useSettings() {
  const settings = ref<Settings>({
    fan: 0,
    led: 0,
    ptc: 0,
    display: "All",
    mode: "manual",
    thermostatTarget: 22,
  });

  async function fetchSettings() {
    const { data, error } = await supabase
      .from("iot_settings")
      .select("*")
      .eq("id", "1")
      .maybeSingle();

    if (error) {
      console.error("Error fetching settings:", error);
      return;
    }
    if (data) {
      settings.value = {
        fan: data.fan,
        led: data.led,
        ptc: data.ptc,
        display: data.display,
        mode: data.mode as "manual" | "auto",
        thermostatTarget: Number(data.thermostat_target),
      };
    }
  }

  fetchSettings();

  const channel = supabase
    .channel(`iot-settings-realtime-${Math.random()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "iot_settings", filter: "id=eq.1" },
      (payload) => {
        const newRow = payload.new as any;
        if (newRow) {
          settings.value = {
            fan: newRow.fan,
            led: newRow.led,
            ptc: newRow.ptc,
            display: newRow.display,
            mode: newRow.mode as "manual" | "auto",
            thermostatTarget: Number(newRow.thermostat_target),
          };
        }
      }
    )
    .subscribe();

  onUnmounted(() => {
    supabase.removeChannel(channel);
  });

  async function updateSettings(updates: Partial<Settings>) {
    const dbUpdates: any = {};
    if (updates.fan !== undefined) dbUpdates.fan = updates.fan;
    if (updates.led !== undefined) dbUpdates.led = updates.led;
    if (updates.ptc !== undefined) dbUpdates.ptc = updates.ptc;
    if (updates.display !== undefined) dbUpdates.display = updates.display;
    if (updates.mode !== undefined) dbUpdates.mode = updates.mode;
    if (updates.thermostatTarget !== undefined) dbUpdates.thermostat_target = updates.thermostatTarget;

    const { error } = await supabase
      .from("iot_settings")
      .update(dbUpdates)
      .eq("id", "1");

    if (error) {
      console.error("Error updating settings:", error);
    }
  }

  async function sendCommand(message: string) {
    const { error } = await supabase
      .from("iot_commands")
      .insert({ message });

    if (error) {
      console.error("Error sending command:", error);
    }
  }

  return { settings, updateSettings, sendCommand };
}
