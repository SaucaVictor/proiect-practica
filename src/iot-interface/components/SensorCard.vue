<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { supabase } from "@/services/supabase/client";
import type { SensorData } from "../composables/useSensors";

const props = defineProps<{ name: string; data: SensorData }>();
const pulse = ref(false);

const UNITS: Record<string, string> = {
  Temperature: "°C",
  Curent: " A",
  Persons: " pers.",
  Light: "",
  Voltage: " V",
};

const ICONS: Record<string, string> = {
  Temperature: "🌡️",
  Curent: "⚡",
  Persons: "👥",
  Light: "☀️",
  Voltage: "🔌",
};

const LABELS: Record<string, string> = {
  Temperature: "Temperatură",
  Curent: "Curent",
  Persons: "Persoane",
  Light: "Lumină",
  Voltage: "Tensiune",
};

const unit  = computed(() => UNITS[props.name]  ?? "");
const icon  = computed(() => ICONS[props.name]  ?? "");
const label = computed(() => LABELS[props.name] ?? props.name);

watch(() => props.data.latestValue, () => {
  pulse.value = true;
  setTimeout(() => (pulse.value = false), 700);
});

const KNOWN = new Set(["Persons", "Temperature", "Light", "Curent"]);
const isStale = computed(() => !KNOWN.has(props.name));

async function deleteSensor() {
  if (confirm(`Stergi senzorul "${props.name}" din Supabase?`)) {
    const { error } = await supabase.from("iot_sensors").delete().eq("name", props.name);
    if (error) console.error("Error deleting sensor:", error);
  }
}
</script>

<template>
  <div 
    class="relative bg-[var(--iot-card-bg)] border border-[var(--iot-border)] rounded-2xl p-5.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--iot-accent)]/55 hover:shadow-[0_4px_20px_rgba(92,114,243,0.12)]"
    :class="[pulse ? 'border-[var(--iot-accent)] shadow-[0_0_12px_rgba(92,114,243,0.25)]' : '', isStale ? 'border-red-500/20 opacity-75' : '']"
  >
    <!-- Delete Button -->
    <button 
      v-if="isStale" 
      class="absolute top-3.5 right-3.5 w-6 h-6 rounded-lg border-0 bg-red-500/10 text-red-400 text-xs cursor-pointer flex items-center justify-center transition-colors duration-200 hover:bg-red-500/35" 
      title="Sterge senzor inactiv" 
      @click.stop="deleteSensor"
    >
      ✕
    </button>

    <!-- Card Header -->
    <div class="flex items-center gap-2 mb-3.5">
      <span class="text-base">{{ icon }}</span>
      <span class="text-[10px] font-bold tracking-widest uppercase text-[var(--iot-text-muted)]">{{ label }}</span>
      <span v-if="isStale" class="text-[9px] font-bold tracking-wider uppercase text-red-400 ml-auto bg-red-500/10 px-2 py-0.5 rounded">STALE</span>
    </div>

    <!-- Card Value -->
    <div class="font-mono text-3.5xl font-medium text-[var(--iot-text)] mb-3">
      {{ data.latestValue }}<span class="text-lg text-[var(--iot-accent)] ml-1">{{ unit }}</span>
    </div>

    <!-- Progress bar for light sensor -->
    <div v-if="name === 'Light'" class="h-1 bg-white/10 rounded-full mb-2 overflow-hidden">
      <div class="h-full bg-gradient-to-r from-[var(--iot-accent)] to-[#f59e0b] rounded-full transition-all duration-500" :style="{ width: (Math.min(100, Math.max(0, (Number(data.latestValue) / 1023 * 100))) + '%') }" />
    </div>
  </div>
</template>
