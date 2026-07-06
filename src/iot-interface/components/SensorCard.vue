<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { supabase } from "@/services/supabase/client";
import type { SensorData } from "../composables/useSensors";

const props = defineProps<{ name: string; data: SensorData }>();
const pulse = ref(false);

const UNITS: Record<string, string> = {
  Temperature: "°C",
  Curent:      " A",
  Persons:     "",
  Light:       "",
  Voltage:     " V",
};

const LABELS: Record<string, string> = {
  Temperature: "Temperatura",
  Curent:      "Curent",
  Persons:     "Persoane",
  Light:       "Lumina",
  Voltage:     "Tensiune",
};

const ICON_PATHS: Record<string, { path: string; color: string }> = {
  Temperature: { color: "#ef4444", path: "M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" },
  Curent:      { color: "#3b82f6", path: "M13 2 3 14h9l-1 8 10-12h-9l1-8z" },
  Persons:     { color: "#8b5cf6", path: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  Light:       { color: "#f59e0b", path: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z" },
  Voltage:     { color: "#06b6d4", path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" },
};

const unit  = computed(() => UNITS[props.name]  ?? "");
const label = computed(() => LABELS[props.name] ?? props.name);
const icon  = computed(() => ICON_PATHS[props.name] ?? { path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", color: "#9aa0b2" });

watch(() => props.data.latestValue, () => {
  pulse.value = true;
  setTimeout(() => (pulse.value = false), 700);
});

const KNOWN = new Set(["Persons", "Temperature", "Light", "Curent"]);
const isStale = computed(() => !KNOWN.has(props.name));
const lightPercent = computed(() => Math.min(100, Math.max(0, (Number(props.data.latestValue) / 1023) * 100)));

async function deleteSensor() {
  if (confirm(`Stergi senzorul "${props.name}" din Supabase?`)) {
    const { error } = await supabase.from("iot_sensors").delete().eq("name", props.name);
    if (error) console.error("Error deleting sensor:", error);
  }
}
</script>

<template>
  <div class="sensor-card" :class="[pulse ? 'sensor-card--pulse' : '', isStale ? 'sensor-card--stale' : '']">
    <button v-if="isStale" class="sensor-delete-btn" title="Sterge senzor inactiv" @click.stop="deleteSensor">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>

    <div class="sensor-header">
      <div class="sensor-icon-wrap" :style="{ background: icon.color + '15', borderColor: icon.color + '30' }">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="icon.color" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path :d="icon.path"/>
        </svg>
      </div>
      <span class="sensor-label">{{ label }}</span>
      <span v-if="isStale" class="sensor-stale-badge">STALE</span>
    </div>

    <div class="sensor-value-row">
      <span class="sensor-value">{{ data.latestValue }}</span>
      <span class="sensor-unit">{{ unit }}</span>
    </div>

    <div v-if="name === 'Light'" class="sensor-bar-track">
      <div class="sensor-bar-fill" :style="{ width: lightPercent + '%' }" />
    </div>

    <div v-if="name === 'Persons'" class="sensor-pips">
      <div v-for="i in 10" :key="i" class="sensor-pip" :class="i <= Number(data.latestValue) ? 'sensor-pip--active' : ''" />
    </div>
  </div>
</template>

<style scoped>
.sensor-card {
  position: relative;
  background: var(--iot-card-bg);
  border: 1px solid var(--iot-border);
  border-radius: 16px;
  padding: 20px;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}
.sensor-card:hover {
  transform: translateY(-2px);
  border-color: var(--iot-accent-border);
  box-shadow: 0 6px 24px rgba(92, 114, 243, 0.1);
}
.sensor-card--pulse { animation: card-pulse 0.65s ease-out forwards; }
@keyframes card-pulse {
  0%   { border-color: var(--iot-accent-border); box-shadow: 0 0 0 4px var(--iot-accent-subtle); }
  100% { border-color: var(--iot-border); box-shadow: none; }
}
.sensor-card--stale { border-color: var(--iot-danger-border); opacity: 0.72; }

.sensor-delete-btn {
  position: absolute; top: 12px; right: 12px;
  width: 24px; height: 24px; border-radius: 8px; border: none;
  background: var(--iot-danger-subtle); color: var(--iot-danger);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.sensor-delete-btn:hover { background: rgba(239, 68, 68, 0.2); }

.sensor-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.sensor-icon-wrap {
  width: 30px; height: 30px; border-radius: 8px; border: 1px solid;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.sensor-label {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--iot-text-muted); flex: 1;
}
.sensor-stale-badge {
  font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--iot-danger); background: var(--iot-danger-subtle); padding: 2px 6px; border-radius: 4px;
}

.sensor-value-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 12px; }
.sensor-value {
  font-size: 32px; font-weight: 500; font-variant-numeric: tabular-nums;
  color: var(--iot-text); line-height: 1;
}
.sensor-unit { font-size: 16px; font-weight: 500; color: var(--iot-accent); }

.sensor-bar-track { height: 3px; background: var(--iot-slider-track); border-radius: 99px; overflow: hidden; }
.sensor-bar-fill { height: 100%; background: linear-gradient(to right, var(--iot-accent), #f59e0b); border-radius: 99px; transition: width 0.5s ease; }

.sensor-pips { display: flex; gap: 4px; flex-wrap: wrap; }
.sensor-pip { width: 8px; height: 8px; border-radius: 50%; background: var(--iot-slider-track); transition: background 0.25s ease; }
.sensor-pip--active { background: var(--iot-accent); }
</style>
