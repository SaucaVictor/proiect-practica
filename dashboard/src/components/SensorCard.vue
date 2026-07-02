<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
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
  Temperature: "",
  Curent: "",
  Persons: "",
  Light: "",
  Voltage: "",
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
  if (confirm(`Stergi senzorul "${props.name}" din Firestore?`)) {
    await deleteDoc(doc(db, "sensors", props.name));
  }
}
</script>

<template>
  <div class="card" :class="{ pulse, stale: isStale }">
    <button v-if="isStale" class="del-btn" title="Sterge senzor inactiv" @click.stop="deleteSensor">✕</button>
    <div class="sensor-header">
      <span class="icon">{{ icon }}</span>
      <span class="sensor-name">{{ label }}</span>
      <span v-if="isStale" class="stale-badge">•</span>
    </div>
    <div class="sensor-value">{{ data.latestValue }}<span class="unit">{{ unit }}</span></div>
    <div v-if="name === 'Light'" class="light-bar">
      <div class="light-fill" :style="{ width: (Number(data.latestValue) / 1023 * 100) + '%' }" />
    </div>
  </div>
</template>

<style scoped>
.card {
  background: rgba(19, 22, 31, 0.75);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  padding: 20px 20px 14px;
  backdrop-filter: blur(16px);
  transition: border-color .2s, box-shadow .2s, transform .2s;
  animation: fadeUp .35s ease both;
  position: relative;
}
.card:hover { border-color: rgba(99,102,241,.4); box-shadow: 0 0 28px rgba(99,102,241,.12); transform: translateY(-2px); }
.card.pulse { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,.18); }
@keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }

.sensor-header { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.icon { font-size: 1rem; }
.sensor-name { font-size: 0.68rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #64748b; }
.sensor-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 2rem; font-weight: 500; color: #a5b4fc;
  line-height: 1; margin-bottom: 10px;
}
.unit { font-size: 1rem; color: #6366f1; margin-left: 2px; }
.light-bar { height: 4px; background: rgba(255,255,255,0.08); border-radius: 4px; margin-bottom: 10px; overflow: hidden; }
.light-fill { height: 100%; background: linear-gradient(90deg, #f59e0b, #fbbf24); border-radius: 4px; transition: width .5s ease; }
.card.stale { border-color: rgba(239,68,68,0.2); opacity: 0.75; }
.del-btn {
  position: absolute; top: 10px; right: 10px;
  width: 22px; height: 22px; border-radius: 6px; border: none;
  background: rgba(239,68,68,0.15); color: #f87171;
  font-size: 0.7rem; cursor: pointer; display: none;
  align-items: center; justify-content: center;
  transition: background .15s;
}
.card:hover .del-btn { display: flex; }
.del-btn:hover { background: rgba(239,68,68,0.35); }
.stale-badge {
  font-size: 0.6rem; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: #f87171; margin-left: auto;
  background: rgba(239,68,68,0.1); padding: 2px 6px; border-radius: 4px;
}
.sensor-footer { display: flex; justify-content: space-between; font-size: 0.68rem; color: #475569; }
.ip { font-family: 'JetBrains Mono', monospace; }
</style>

