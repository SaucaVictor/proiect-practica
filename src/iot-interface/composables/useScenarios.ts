import { ref, onUnmounted } from "vue";
import { supabase } from "@/services/supabase/client";

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

  function mapDbToScenario(row: any): Scenario {
    return {
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      type: row.type as "simple" | "light_control" | "temperature_control",
      conditions: row.conditions || [],
      actions: row.actions || [],
      createdAt: row.created_at,
      thermostatTarget: row.thermostat_target ? Number(row.thermostat_target) : undefined,
      deadband: row.deadband ? Number(row.deadband) : undefined,
      maxRange: row.max_range ? Number(row.max_range) : undefined,
      highThreshold: row.high_threshold ? Number(row.high_threshold) : undefined,
      lowThreshold: row.low_threshold ? Number(row.low_threshold) : undefined,
      midBrightness: row.mid_brightness ? Number(row.mid_brightness) : undefined,
      fullBrightness: row.full_brightness ? Number(row.full_brightness) : undefined,
      offDelay: row.off_delay ? Number(row.off_delay) : undefined,
    };
  }

  async function fetchScenarios() {
    const { data, error } = await supabase
      .from("iot_scenarios")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching scenarios:", error);
      return;
    }
    if (data) {
      scenarios.value = data.map(mapDbToScenario);
    }
  }

  fetchScenarios();

  const channel = supabase
    .channel(`iot-scenarios-realtime-${Math.random()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "iot_scenarios" },
      () => {
        fetchScenarios();
      }
    )
    .subscribe();

  onUnmounted(() => {
    supabase.removeChannel(channel);
  });

  async function addScenario(s: Omit<Scenario, "id">) {
    const dbRow = {
      name: s.name,
      enabled: s.enabled,
      type: s.type,
      conditions: s.conditions,
      actions: s.actions,
      thermostat_target: s.thermostatTarget,
      deadband: s.deadband,
      max_range: s.maxRange,
      high_threshold: s.highThreshold,
      low_threshold: s.lowThreshold,
      mid_brightness: s.midBrightness,
      full_brightness: s.fullBrightness,
      off_delay: s.offDelay,
    };

    const { error } = await supabase.from("iot_scenarios").insert(dbRow);
    if (error) console.error("Error adding scenario:", error);
  }

  async function updateScenario(id: string, updates: Partial<Scenario>) {
    const dbRow: any = {};
    if (updates.name !== undefined) dbRow.name = updates.name;
    if (updates.enabled !== undefined) dbRow.enabled = updates.enabled;
    if (updates.conditions !== undefined) dbRow.conditions = updates.conditions;
    if (updates.actions !== undefined) dbRow.actions = updates.actions;
    if (updates.thermostatTarget !== undefined) dbRow.thermostat_target = updates.thermostatTarget;
    if (updates.deadband !== undefined) dbRow.deadband = updates.deadband;
    if (updates.maxRange !== undefined) dbRow.max_range = updates.maxRange;
    if (updates.highThreshold !== undefined) dbRow.high_threshold = updates.highThreshold;
    if (updates.lowThreshold !== undefined) dbRow.low_threshold = updates.lowThreshold;
    if (updates.midBrightness !== undefined) dbRow.mid_brightness = updates.midBrightness;
    if (updates.fullBrightness !== undefined) dbRow.full_brightness = updates.fullBrightness;
    if (updates.offDelay !== undefined) dbRow.off_delay = updates.offDelay;

    const { error } = await supabase.from("iot_scenarios").update(dbRow).eq("id", id);
    if (error) console.error("Error updating scenario:", error);
  }

  async function deleteScenario(id: string) {
    const { error } = await supabase.from("iot_scenarios").delete().eq("id", id);
    if (error) console.error("Error deleting scenario:", error);
  }

  async function toggleScenario(id: string, enabled: boolean) {
    await updateScenario(id, { enabled });
  }

  async function seedDefaults() {
    const { data: list } = await supabase.from("iot_scenarios").select("type");
    const types = (list || []).map(r => r.type);

    if (!types.includes("light_control")) {
      await addScenario({
        name: "Light Control",
        enabled: false,
        type: "light_control",
        conditions: [],
        actions: [],
      });
    }
    if (!types.includes("temperature_control")) {
      await addScenario({
        name: "Temperature Control",
        enabled: false,
        type: "temperature_control",
        conditions: [],
        actions: [],
        thermostatTarget: 22,
      });
    }
  }

  return { scenarios, addScenario, updateScenario, deleteScenario, toggleScenario, seedDefaults };
}
