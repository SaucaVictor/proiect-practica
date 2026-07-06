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
  showToast(m === "auto" ? "Mod Automat activat" : "Mod Manual activat");
}

const DISPLAY_OPTIONS = [
  { value: "All",         label: "Toți senzorii"  },
  { value: "Persons",     label: "Persoane"        },
  { value: "Temperature", label: "Temperatură"     },
  { value: "Light",       label: "Lumină ambiantă" },
  { value: "Curent",      label: "Curent"          },
];

watch(settings, (s) => {
  fanSlider.value  = s.fan;
  ledSlider.value  = s.led;
  ptcSlider.value  = s.ptc;
  selectedDisplay.value = s.display ?? "All";
}, { immediate: true });

function showToast(msg: string, type: "ok" | "err" = "ok") {
  clearTimeout(toastTimer);
  toast.value = { msg, type };
  toastTimer = setTimeout(() => (toast.value = null), 2800);
}

async function setFan(val: number)     { fanSlider.value  = val; await updateSettings({ fan:  val }); showToast(`Ventilator → ${val}`); }
async function setLed(val: number)     { ledSlider.value  = val; await updateSettings({ led:  val }); showToast(`LED → ${val}`); }
async function setPtc(val: number)     { ptcSlider.value  = val; await updateSettings({ ptc:  val }); showToast(`Încălzitor → ${val}`); }
async function setDisplay(val: string) {
  selectedDisplay.value = val;
  await updateSettings({ display: val });
  showToast(`Display → ${val}`);
}
async function send(msg: string) {
  if (!msg.trim()) return;
  await sendCommand(msg.trim());
  showToast(`Trimis: ${msg.trim()}`);
  if (msg === rawCmd.value) rawCmd.value = "";
}

function pct(val: number) { return Math.round(val / 255 * 100); }
</script>

<template>
  <div class="cp-card">

    <!-- Mode Toggle -->
    <div class="cp-section">
      <span class="cp-section-label">Mod operare</span>
      <div class="cp-mode-row">
        <button
          class="cp-mode-btn"
          :class="{ 'cp-mode-btn--active': currentMode === 'manual' }"
          @click="setMode('manual')"
        >
          Manual
        </button>
        <button
          class="cp-mode-btn cp-mode-btn--auto"
          :class="{ 'cp-mode-btn--active-auto': currentMode === 'auto' }"
          @click="setMode('auto')"
        >
          Automat
        </button>
      </div>
    </div>

    <!-- Auto pilot notice -->
    <div v-if="currentMode === 'auto'" class="cp-auto-notice">
      <div class="cp-auto-dot" />
      <div>
        <div class="cp-auto-title">Pilot automat activ</div>
        <div class="cp-auto-sub">Scenariile gestionează mediul. Controlul manual este suspendat.</div>
      </div>
    </div>

    <!-- Controls (locked in auto mode) -->
    <div class="cp-controls" :class="{ 'cp-controls--locked': currentMode === 'auto' }">

      <!-- LED -->
      <div class="cp-control-block">
        <div class="cp-control-header">
          <div class="cp-control-left">
            <div class="cp-control-dot cp-control-dot--yellow" :class="{ 'cp-control-dot--on': ledSlider > 0 }" />
            <span class="cp-control-name">LED</span>
            <span class="cp-control-pin">pin 26</span>
          </div>
          <div class="cp-control-actions">
            <button class="cp-tog" :class="{ 'cp-tog--off': ledSlider === 0 }" @click="setLed(0)">OFF</button>
            <button class="cp-tog" :class="{ 'cp-tog--on':  ledSlider > 0  }" @click="setLed(255)">ON</button>
          </div>
        </div>
        <input
          type="range" min="0" max="255" :value="ledSlider"
          @input="ledSlider = +($event.target as HTMLInputElement).value"
          @change="setLed(ledSlider)"
          class="cp-slider cp-slider--blue"
        />
        <div class="cp-slider-val">{{ pct(ledSlider) }}%</div>
      </div>

      <!-- Fan -->
      <div class="cp-control-block">
        <div class="cp-control-header">
          <div class="cp-control-left">
            <div class="cp-control-dot cp-control-dot--accent" :class="{ 'cp-control-dot--on': fanSlider > 0 }" />
            <span class="cp-control-name">Ventilator</span>
            <span class="cp-control-pin">pin 25</span>
          </div>
          <div class="cp-control-actions">
            <button class="cp-tog" :class="{ 'cp-tog--off': fanSlider === 0 }" @click="setFan(0)">OFF</button>
            <button class="cp-tog" :class="{ 'cp-tog--on':  fanSlider > 0  }" @click="setFan(255)">ON</button>
          </div>
        </div>
        <input
          type="range" min="0" max="255" :value="fanSlider"
          @input="fanSlider = +($event.target as HTMLInputElement).value"
          @change="setFan(fanSlider)"
          class="cp-slider cp-slider--accent"
        />
        <div class="cp-slider-val">{{ pct(fanSlider) }}%</div>
      </div>

      <!-- PTC Heater -->
      <div class="cp-control-block">
        <div class="cp-control-header">
          <div class="cp-control-left">
            <div class="cp-control-dot cp-control-dot--red" :class="{ 'cp-control-dot--on': ptcSlider > 0 }" />
            <span class="cp-control-name">Încălzitor PTC</span>
            <span class="cp-control-pin">pin 17</span>
          </div>
          <div class="cp-control-actions">
            <button class="cp-tog" :class="{ 'cp-tog--off': ptcSlider === 0 }" @click="setPtc(0)">OFF</button>
            <button class="cp-tog" :class="{ 'cp-tog--on':  ptcSlider > 0  }" @click="setPtc(255)">ON</button>
          </div>
        </div>
        <input
          type="range" min="0" max="255" :value="ptcSlider"
          @input="ptcSlider = +($event.target as HTMLInputElement).value"
          @change="setPtc(ptcSlider)"
          class="cp-slider cp-slider--red"
        />
        <div class="cp-slider-val">{{ pct(ptcSlider) }}%</div>
      </div>

      <!-- Display selector -->
      <div class="cp-control-block">
        <span class="cp-section-label" style="margin-bottom:8px">Ecran OLED</span>
        <div class="cp-display-grid">
          <button
            v-for="opt in DISPLAY_OPTIONS"
            :key="opt.value"
            class="cp-display-btn"
            :class="{ 'cp-display-btn--active': selectedDisplay === opt.value }"
            @click="setDisplay(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Quick commands -->
      <div class="cp-quick-row">
        <button class="cp-quick-btn" @click="send('CMD;PING')">Ping</button>
        <button class="cp-quick-btn" @click="send('CMD;RESET')">Reset</button>
      </div>

      <!-- Raw command -->
      <div class="cp-cmd-row">
        <input
          v-model="rawCmd"
          class="cp-cmd-input"
          placeholder="CMD;pin:value"
          spellcheck="false"
          @keydown.enter="send(rawCmd)"
        />
        <button class="cp-cmd-send" @click="send(rawCmd)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2 11 13M22 2 15 22 11 13 2 9l20-7z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Toast -->
    <Transition
      enter-active-class="cp-toast-enter-active"
      enter-from-class="cp-toast-enter-from"
      leave-active-class="cp-toast-leave-active"
      leave-to-class="cp-toast-leave-to"
    >
      <div
        v-if="toast"
        class="cp-toast"
        :class="toast.type === 'err' ? 'cp-toast--err' : 'cp-toast--ok'"
      >
        {{ toast.msg }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── Card ── */
.cp-card {
  position: relative;
  background: var(--iot-card-bg);
  border: 1px solid var(--iot-border);
  border-radius: 18px;
  padding: 24px;
}

/* ── Section header ── */
.cp-section { margin-bottom: 20px; }
.cp-section-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--iot-text-muted);
  margin-bottom: 10px;
}

/* ── Mode toggle ── */
.cp-mode-row { display: flex; gap: 6px; }
.cp-mode-btn {
  flex: 1;
  padding: 7px 0;
  border-radius: 10px;
  border: 1px solid var(--iot-border);
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: var(--iot-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.cp-mode-btn:hover { color: var(--iot-text); border-color: var(--iot-border-hover); }
.cp-mode-btn--active {
  background: var(--iot-accent-subtle);
  border-color: var(--iot-accent-border);
  color: var(--iot-accent);
}
.cp-mode-btn--auto:hover { color: var(--iot-text); }
.cp-mode-btn--active-auto {
  background: var(--iot-success-subtle);
  border-color: var(--iot-success-border);
  color: var(--iot-success);
}

/* ── Auto notice ── */
.cp-auto-notice {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  background: var(--iot-success-subtle);
  border: 1px solid var(--iot-success-border);
  margin-bottom: 20px;
}
.cp-auto-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--iot-success); margin-top: 5px; flex-shrink: 0;
  box-shadow: 0 0 0 3px var(--iot-success-subtle);
  animation: dot-pulse 1.5s ease-in-out infinite;
}
@keyframes dot-pulse {
  0%, 100% { box-shadow: 0 0 0 3px var(--iot-success-subtle); }
  50%       { box-shadow: 0 0 0 6px transparent; }
}
.cp-auto-title { font-size: 12px; font-weight: 700; color: var(--iot-success); margin-bottom: 3px; }
.cp-auto-sub { font-size: 11px; color: var(--iot-text-muted); line-height: 1.5; }

/* ── Controls wrapper ── */
.cp-controls { display: flex; flex-direction: column; gap: 22px; }
.cp-controls--locked { opacity: 0.38; pointer-events: none; user-select: none; transition: opacity 0.3s ease; }

/* ── Control block ── */
.cp-control-block { display: flex; flex-direction: column; gap: 8px; }
.cp-control-header { display: flex; align-items: center; justify-content: space-between; }
.cp-control-left { display: flex; align-items: center; gap: 8px; }
.cp-control-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--iot-text-dim);
  transition: background 0.2s ease, box-shadow 0.2s ease;
}
.cp-control-dot--yellow.cp-control-dot--on  { background: #f59e0b; box-shadow: 0 0 6px rgba(245,158,11,0.5); }
.cp-control-dot--accent.cp-control-dot--on  { background: var(--iot-accent); box-shadow: 0 0 6px rgba(92,114,243,0.5); }
.cp-control-dot--red.cp-control-dot--on     { background: var(--iot-danger); box-shadow: 0 0 6px rgba(239,68,68,0.5); }

.cp-control-name { font-size: 13px; font-weight: 600; color: var(--iot-text); }
.cp-control-pin { font-size: 10px; color: var(--iot-text-dim); font-style: italic; }

.cp-control-actions { display: flex; gap: 4px; }
.cp-tog {
  padding: 3px 9px;
  border-radius: 6px;
  border: 1px solid var(--iot-border);
  background: transparent;
  font-size: 10px;
  font-weight: 700;
  color: var(--iot-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.cp-tog:hover { border-color: var(--iot-border-hover); color: var(--iot-text); }
.cp-tog--off {
  background: var(--iot-danger-subtle);
  border-color: var(--iot-danger-border);
  color: var(--iot-danger);
}
.cp-tog--on {
  background: var(--iot-success-subtle);
  border-color: var(--iot-success-border);
  color: var(--iot-success);
}

/* ── Sliders ── */
.cp-slider {
  width: 100%;
  height: 4px;
  border-radius: 99px;
  background: var(--iot-slider-track);
  appearance: none;
  cursor: pointer;
  outline: none;
}
.cp-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px; height: 14px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s;
}
.cp-slider::-webkit-slider-thumb:active { transform: scale(1.25); }
.cp-slider--blue::-webkit-slider-thumb { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.2); }
.cp-slider--accent::-webkit-slider-thumb { background: var(--iot-accent); box-shadow: 0 0 0 3px var(--iot-accent-subtle); }
.cp-slider--red::-webkit-slider-thumb { background: var(--iot-danger); box-shadow: 0 0 0 3px var(--iot-danger-subtle); }

.cp-slider-val { font-size: 10px; font-family: monospace; color: var(--iot-text-muted); text-align: right; margin-top: -4px; }

/* ── Display grid ── */
.cp-display-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.cp-display-btn {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--iot-border);
  background: transparent;
  font-size: 11px;
  color: var(--iot-text-muted);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}
.cp-display-btn:hover { border-color: var(--iot-accent-border); color: var(--iot-text); background: var(--iot-accent-subtle); }
.cp-display-btn--active {
  background: var(--iot-accent-subtle);
  border-color: var(--iot-accent-border);
  color: var(--iot-accent);
  font-weight: 600;
}

/* ── Quick commands ── */
.cp-quick-row { display: flex; gap: 6px; }
.cp-quick-btn {
  flex: 1;
  padding: 9px;
  border-radius: 10px;
  border: 1px solid var(--iot-border);
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  color: var(--iot-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.cp-quick-btn:hover { border-color: var(--iot-accent-border); background: var(--iot-accent-subtle); color: var(--iot-accent); }

/* ── Raw command row ── */
.cp-cmd-row { display: flex; gap: 6px; }
.cp-cmd-input {
  flex: 1;
  background: var(--iot-surface);
  border: 1px solid var(--iot-border);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 11px;
  font-family: monospace;
  color: var(--iot-text);
  outline: none;
  transition: border-color 0.15s;
}
.cp-cmd-input::placeholder { color: var(--iot-text-dim); }
.cp-cmd-input:focus { border-color: var(--iot-accent-border); }
.cp-cmd-send {
  width: 36px; height: 36px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, var(--iot-accent), var(--iot-accent-hover));
  color: white;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s, transform 0.15s;
}
.cp-cmd-send:hover { opacity: 0.88; transform: scale(1.05); }

/* ── Toast ── */
.cp-toast {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 7px 16px;
  border-radius: 99px;
  border: 1px solid;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
}
.cp-toast--ok {
  background: var(--iot-surface);
  border-color: var(--iot-accent-border);
  color: var(--iot-accent);
}
.cp-toast--err {
  background: var(--iot-danger-subtle);
  border-color: var(--iot-danger-border);
  color: var(--iot-danger);
}
.cp-toast-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.cp-toast-enter-from   { opacity: 0; transform: translateX(-50%) translateY(6px); }
.cp-toast-leave-active { transition: opacity 0.15s ease; }
.cp-toast-leave-to     { opacity: 0; }
</style>
