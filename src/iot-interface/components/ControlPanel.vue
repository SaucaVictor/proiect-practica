<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useSettings } from "../composables/useSettings";

const { settings, updateSettings, sendCommand } = useSettings();

const fanSlider = ref(0);
const ledSlider = ref(0);
const ptcSlider = ref(0);
const rawCmd = ref("");
const selectedDisplay = ref("All");
const toast = ref<{ msg: string; type: "ok" | "err" } | null>(null);
let toastTimer: ReturnType<typeof setTimeout>;

const currentMode = computed(() => settings.value.mode ?? "manual");

async function setMode(m: "manual" | "auto") {
  await updateSettings({ mode: m });
  showToast(m === "auto" ? "Mod Automat ACTIV" : "Mod Manual ACTIV");
}

const DISPLAY_OPTIONS = [
  { value: "All",         label: "Toți senzorii",  icon: "" },
  { value: "Persons",     label: "Persoane",        icon: "" },
  { value: "Temperature", label: "Temperatură",     icon: "" },
  { value: "Light",       label: "Nivel lumină",    icon: "" },
  { value: "Curent",      label: "Curent",          icon: "" },
];

watch(settings, (s) => {
  fanSlider.value = s.fan;
  ledSlider.value = s.led;
  ptcSlider.value = s.ptc;
  selectedDisplay.value = s.display ?? "All";
}, { immediate: true });

function showToast(msg: string, type: "ok" | "err" = "ok") {
  clearTimeout(toastTimer);
  toast.value = { msg, type };
  toastTimer = setTimeout(() => (toast.value = null), 2800);
}

async function setFan(val: number) { fanSlider.value = val; await updateSettings({ fan: val }); showToast(`Fan → ${val}`); }
async function setLed(val: number) { ledSlider.value = val; await updateSettings({ led: val }); showToast(`LED → ${val}`); }
async function setPtc(val: number) { ptcSlider.value = val; await updateSettings({ ptc: val }); showToast(`PTC → ${val}`); }
async function setDisplay(val: string) {
  selectedDisplay.value = val;
  await updateSettings({ display: val });
  showToast(`Display → ${val}`);
}
async function send(msg: string) {
  if (!msg.trim()) return;
  await sendCommand(msg.trim());
  showToast(`Sent: ${msg.trim()}`);
  if (msg === rawCmd.value) rawCmd.value = "";
}
</script>

<template>
  <div class="relative bg-[var(--iot-card-bg)] border border-[var(--iot-border)] rounded-2xl p-8 ">

    <!-- Mode Toggle -->
    <div class="flex items-center justify-between mb-7">
      <span class="text-[10px] font-bold tracking-wider uppercase text-[var(--iot-text-muted)]">Mod Operare</span>
      <div class="flex gap-1.5">
        <button 
          class="px-3.5 py-1.5 rounded-lg border border-white/10 bg-transparent text-xs font-semibold text-[var(--iot-text-muted)] cursor-pointer transition-all duration-200 hover:text-[var(--iot-text)]"
          :class="{ 'bg-[var(--iot-accent)]/15 border-[var(--iot-accent)] text-[var(--iot-accent)]': currentMode === 'manual' }" 
          @click="setMode('manual')"
        >
          Manual
        </button>
        <button 
          class="px-3.5 py-1.5 rounded-lg border border-white/10 bg-transparent text-xs font-semibold text-[var(--iot-text-muted)] cursor-pointer transition-all duration-200 hover:text-[var(--iot-text)]"
          :class="{ 'bg-emerald-500/15 border-emerald-500 text-emerald-400': currentMode === 'auto' }"   
          @click="setMode('auto')"
        >
          Automat
        </button>
      </div>
    </div>

    <!-- Auto Pilot Active Notice -->
    <div v-if="currentMode === 'auto'" class="flex gap-3.5 items-start text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 mb-5.5">
      <span class="text-base leading-none">🧠</span>
      <div>
        <h4 class="font-bold tracking-wide uppercase mb-1">Pilot Automat Activ</h4>
        <p class="text-emerald-500/70 leading-relaxed">Scenariile gestionează dinamic mediul pe baza telemetriei senzorilor. Controlul manual este blocat.</p>
      </div>
    </div>

    <!-- Controls Wrapper -->
    <div class="space-y-7" :class="{ 'opacity-40 pointer-events-none select-none duration-300': currentMode === 'auto' }">
      <!-- LED Block -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-[var(--iot-text)]">LED <span class="text-[10px] text-[var(--iot-text-muted)] italic font-normal ml-1">pin 26</span></span>
          <div class="flex gap-1">
            <button class="px-2.5 py-1 rounded bg-transparent border border-white/5 text-[10px] font-semibold text-[var(--iot-text-muted)] hover:border-white/10 cursor-pointer" :class="{ 'bg-red-500/15 border-red-500/30 text-red-400': ledSlider === 0 }" @click="setLed(0)">OFF</button>
            <button class="px-2.5 py-1 rounded bg-transparent border border-white/5 text-[10px] font-semibold text-[var(--iot-text-muted)] hover:border-white/10 cursor-pointer" :class="{ 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400': ledSlider > 0 }" @click="setLed(255)">ON</button>
          </div>
        </div>
        <input type="range" min="0" max="255" :value="ledSlider"
          @input="ledSlider = +($event.target as HTMLInputElement).value"
          @change="setLed(ledSlider)" class="w-full h-1 bg-[var(--iot-slider-track)] rounded-lg appearance-none cursor-pointer accent-[var(--iot-accent)]" />
        <span class="text-[10px] font-mono text-[var(--iot-text-muted)] text-right -mt-1">{{ ledSlider }} / 255</span>
      </div>

      <!-- Fan Block -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-[var(--iot-text)]">Fan <span class="text-[10px] text-[var(--iot-text-muted)] italic font-normal ml-1">pin 25</span></span>
          <div class="flex gap-1">
            <button class="px-2.5 py-1 rounded bg-transparent border border-white/5 text-[10px] font-semibold text-[var(--iot-text-muted)] hover:border-white/10 cursor-pointer" :class="{ 'bg-red-500/15 border-red-500/30 text-red-400': fanSlider === 0 }" @click="setFan(0)">OFF</button>
            <button class="px-2.5 py-1 rounded bg-transparent border border-white/5 text-[10px] font-semibold text-[var(--iot-text-muted)] hover:border-white/10 cursor-pointer" :class="{ 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400': fanSlider > 0 }" @click="setFan(255)">ON</button>
          </div>
        </div>
        <input type="range" min="0" max="255" :value="fanSlider"
          @input="fanSlider = +($event.target as HTMLInputElement).value"
          @change="setFan(fanSlider)" class="w-full h-1 bg-[var(--iot-slider-track)] rounded-lg appearance-none cursor-pointer accent-[var(--iot-accent)]" />
        <span class="text-[10px] font-mono text-[var(--iot-text-muted)] text-right -mt-1">{{ fanSlider }} / 255</span>
      </div>

      <!-- PTC Heater Block -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-[var(--iot-text)]">Încălzitor PTC <span class="text-[10px] text-[var(--iot-text-muted)] italic font-normal ml-1">pin 17</span></span>
          <div class="flex gap-1">
            <button class="px-2.5 py-1 rounded bg-transparent border border-white/5 text-[10px] font-semibold text-[var(--iot-text-muted)] hover:border-white/10 cursor-pointer" :class="{ 'bg-red-500/15 border-red-500/30 text-red-400': ptcSlider === 0 }" @click="setPtc(0)">OFF</button>
            <button class="px-2.5 py-1 rounded bg-transparent border border-white/5 text-[10px] font-semibold text-[var(--iot-text-muted)] hover:border-white/10 cursor-pointer" :class="{ 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400': ptcSlider > 0 }" @click="setPtc(255)">ON</button>
          </div>
        </div>
        <input type="range" min="0" max="255" :value="ptcSlider"
          @input="ptcSlider = +($event.target as HTMLInputElement).value"
          @change="setPtc(ptcSlider)" class="w-full h-1 bg-[var(--iot-slider-track)] rounded-lg appearance-none cursor-pointer accent-[#ef4444]" />
        <span class="text-[10px] font-mono text-[var(--iot-text-muted)] text-right -mt-1">{{ ptcSlider }} / 255</span>
      </div>

      <!-- OLED Display options -->
      <div class="flex flex-col gap-2.5">
        <span class="text-xs font-semibold text-[var(--iot-text)]">Ecran OLED</span>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="opt in DISPLAY_OPTIONS"
            :key="opt.value"
            class="flex items-center justify-between px-3 py-2 rounded-xl border border-white/5 bg-white/5 text-xs text-[var(--iot-text-muted)] cursor-pointer text-left transition-all duration-200 hover:border-[var(--iot-accent)]/30 hover:bg-[var(--iot-accent)]/5"
            :class="{ 'border-[var(--iot-accent)] bg-[var(--iot-accent)]/15 text-[var(--iot-accent)] font-semibold': selectedDisplay === opt.value }"
            @click="setDisplay(opt.value)"
          >
            <span>{{ opt.label }}</span>
          </button>
        </div>
      </div>

      <!-- Presets buttons -->
      <div class="flex gap-2">
        <button class="flex-1 py-2.5 rounded-xl border border-white/5 bg-white/5 text-xs text-[var(--iot-text-muted)] font-semibold cursor-pointer hover:border-[var(--iot-accent)]/30 hover:bg-[var(--iot-accent)]/5 transition-all duration-200" @click="send('CMD;PING')">Ping</button>
        <button class="flex-1 py-2.5 rounded-xl border border-white/5 bg-white/5 text-xs text-[var(--iot-text-muted)] font-semibold cursor-pointer hover:border-[var(--iot-accent)]/30 hover:bg-[var(--iot-accent)]/5 transition-all duration-200" @click="send('CMD;RESET')">Reset</button>
      </div>

      <!-- Raw command input -->
      <div class="flex gap-2">
        <input 
          v-model="rawCmd" 
          class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[var(--iot-text)] font-mono outline-none transition-colors duration-200 focus:border-[var(--iot-accent)]/50 placeholder-[var(--iot-text-muted)]/40" 
          placeholder="Scrie comanda (CMD;pin:value)..."
          spellcheck="false" 
          @keydown.enter="send(rawCmd)" 
        />
        <button class="px-5 py-2.5 rounded-xl border-0 bg-gradient-to-r from-[var(--iot-accent)] to-[#4453e7] text-white text-xs font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(92,114,243,0.3)]" @click="send(rawCmd)">Trimite</button>
      </div>
    </div>

    <!-- Toast message -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div 
        v-if="toast" 
        class="absolute bottom-4 left-1/2 -translate-x-1/2 px-4.5 py-2 rounded-full border text-xs font-semibold shadow-lg "
        :class="[toast.type === 'err' ? 'border-red-500/30 bg-red-950/80 text-red-400' : 'border-[var(--iot-accent)]/30 bg-[var(--iot-bg-subtle)]/90 text-[var(--iot-accent)]']"
      >
        {{ toast.msg }}
      </div>
    </Transition>
  </div>
</template>
