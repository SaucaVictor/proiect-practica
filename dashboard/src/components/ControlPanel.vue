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
  <div class="panel">

    <!-- Mode Toggle -->
    <div class="mode-row">
      <span class="mode-label">Mod</span>
      <div class="mode-togs">
        <button class="mode-btn" :class="{ active: currentMode === 'manual' }" @click="setMode('manual')">Manual</button>
        <button class="mode-btn auto" :class="{ active: currentMode === 'auto' }"   @click="setMode('auto')">Automat</button>
      </div>
    </div>

    <!-- Auto Badge (Always displayed at the top if auto pilot is engaged) -->
    <div v-if="currentMode === 'auto'" class="auto-badge">
      <div class="badge-text">
        <h3>Pilot Automat Activ</h3>
        <p>Scenariile gestionează dinamic mediul pe baza telemetriei senzorilor. Controlul manual este blocat.</p>
      </div>
    </div>

    <!-- LED Control Block -->
    <div class="ctrl-block" :class="{ 'auto-disabled': currentMode === 'auto' }">
      <div class="ctrl-header">
        <span class="ctrl-name">Led <em>pin 26</em></span>
        <div class="togs">
          <button class="tog" :class="{ active: ledSlider === 0 }" :disabled="currentMode === 'auto'" @click="setLed(0)">OFF</button>
          <button class="tog on" :class="{ active: ledSlider > 0 }" :disabled="currentMode === 'auto'" @click="setLed(255)">ON</button>
        </div>
      </div>
      <input type="range" min="0" max="255" :value="ledSlider" :disabled="currentMode === 'auto'"
        @input="ledSlider = +($event.target as HTMLInputElement).value"
        @change="setLed(ledSlider)" class="slider" />
      <span class="rval">{{ ledSlider }} / 255</span>
    </div>

    <!-- Fan Control Block -->
    <div class="ctrl-block" :class="{ 'auto-disabled': currentMode === 'auto' }">
      <div class="ctrl-header">
        <span class="ctrl-name">Fan <em>pin 25</em></span>
        <div class="togs">
          <button class="tog" :class="{ active: fanSlider === 0 }" :disabled="currentMode === 'auto'" @click="setFan(0)">OFF</button>
          <button class="tog on" :class="{ active: fanSlider > 0 }" :disabled="currentMode === 'auto'" @click="setFan(255)">ON</button>
        </div>
      </div>
      <input type="range" min="0" max="255" :value="fanSlider" :disabled="currentMode === 'auto'"
        @input="fanSlider = +($event.target as HTMLInputElement).value"
        @change="setFan(fanSlider)" class="slider" />
      <span class="rval">{{ fanSlider }} / 255</span>
    </div>

    <!-- PTC Control Block -->
    <div class="ctrl-block" :class="{ 'auto-disabled': currentMode === 'auto' }">
      <div class="ctrl-header">
        <span class="ctrl-name">Încălzitor PTC <em>pin 17</em></span>
        <div class="togs">
          <button class="tog" :class="{ active: ptcSlider === 0 }" :disabled="currentMode === 'auto'" @click="setPtc(0)">OFF</button>
          <button class="tog on" :class="{ active: ptcSlider > 0 }" :disabled="currentMode === 'auto'" @click="setPtc(255)">ON</button>
        </div>
      </div>
      <input type="range" min="0" max="255" :value="ptcSlider" :disabled="currentMode === 'auto'"
        @input="ptcSlider = +($event.target as HTMLInputElement).value"
        @change="setPtc(ptcSlider)" class="slider ptc" />
      <span class="rval">{{ ptcSlider }} / 255</span>
    </div>

    <!-- OLED Display Control Block -->
    <div class="ctrl-block" :class="{ 'auto-disabled': currentMode === 'auto' }">
      <div class="ctrl-header" style="margin-bottom:12px">
        <span class="ctrl-name">Ecran OLED</span>
      </div>
      <div class="display-options">
        <button
          v-for="opt in DISPLAY_OPTIONS"
          :key="opt.value"
          class="disp-btn"
          :class="{ active: selectedDisplay === opt.value }"
          :disabled="currentMode === 'auto'"
          @click="setDisplay(opt.value)"
        >
          <span>{{ opt.label }}</span>
        </button>
      </div>
    </div>

    <!-- Presets -->
    <div class="presets" :class="{ 'auto-disabled': currentMode === 'auto' }">
      <button class="preset" :disabled="currentMode === 'auto'" @click="send('CMD;PING')">Ping</button>
      <button class="preset" :disabled="currentMode === 'auto'" @click="send('CMD;RESET')">Reset</button>
    </div>
    
    <!-- Raw Command Row -->
    <div class="raw-row" :class="{ 'auto-disabled': currentMode === 'auto' }">
      <input v-model="rawCmd" :disabled="currentMode === 'auto'" class="raw-input" placeholder="Scrie comanda..."
        spellcheck="false" @keydown.enter="send(rawCmd)" />
      <button class="send-btn" :disabled="currentMode === 'auto'" @click="send(rawCmd)">Trimite</button>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.msg }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.panel {
  background: rgba(19, 22, 31, 0.72);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 18px; padding: 24px 22px;
  backdrop-filter: blur(18px);
  position: relative;
}

/* Mode toggle */
.mode-row  { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
.mode-label { font-size:.68rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#64748b; }
.mode-togs { display:flex; gap:5px; margin-left:auto; }
.mode-btn  { padding:6px 14px; border-radius:9px; border:1px solid rgba(255,255,255,.1); background:transparent; color:#94a3b8; font-size:.78rem; font-weight:600; cursor:pointer; transition:all .15s; }
.mode-btn.active     { background:rgba(99,102,241,.18); border-color:#6366f1; color:#a5b4fc; }
.mode-btn.auto.active { background:rgba(34,197,94,.15); border-color:rgba(34,197,94,.5); color:#4ade80; }
.auto-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.8rem;
  color: #4ade80;
  background: rgba(34, 197, 94, 0.06);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin-top: 10px;
  margin-bottom: 16px;
}
.pulse-icon {
  font-size: 1.2rem;
  animation: pulse 2s infinite;
}
.badge-text h3 {
  font-size: 0.82rem;
  font-weight: 700;
  margin-bottom: 2px;
  color: #4ade80;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.badge-text p {
  font-size: 0.74rem;
  color: #a7f3d0;
  opacity: 0.85;
  line-height: 1.4;
}
.auto-disabled {
  opacity: 0.45;
  pointer-events: none;
  user-select: none;
}
.ctrl-block { margin-bottom: 24px; transition: opacity 0.25s; }
.ctrl-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.icon { font-size: 1.05rem; }
.ctrl-name { flex: 1; font-size: 0.88rem; font-weight: 600; color: #e2e8f0; }
.ctrl-name em { font-style: normal; font-size: 0.7rem; color: #64748b; margin-left: 4px; }

.togs { display: flex; gap: 5px; }
.tog {
  padding: 4px 13px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.1);
  background: transparent; color: #94a3b8; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; transition: all .15s;
}
.tog:hover { border-color: rgba(99,102,241,.5); color: #e2e8f0; }
.tog.active     { background: rgba(239,68,68,.15); border-color: rgba(239,68,68,.5); color: #f87171; }
.tog.on.active  { background: rgba(34,197,94,.15); border-color: rgba(34,197,94,.5); color: #4ade80; }

.slider { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; border-radius: 4px;
  background: rgba(255,255,255,0.1); outline: none; cursor: pointer; accent-color: #6366f1; display: block; }
.slider.ptc { accent-color: #f97316; }
.rval { font-size: 0.7rem; color: #64748b; float: right; margin-top: 3px; }

.divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 18px 0; }

/* LCD display options */
.display-options { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.disp-btn {
  display: flex; align-items: center; gap: 7px; padding: 9px 12px;
  border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03); color: #94a3b8;
  font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all .15s; text-align: left;
}
.disp-btn:hover { border-color: rgba(99,102,241,.4); color: #e2e8f0; background: rgba(99,102,241,.07); }
.disp-btn.active { border-color: #6366f1; background: rgba(99,102,241,.18); color: #a5b4fc; font-weight: 600; }

/* Presets + raw */
.presets { display: flex; gap: 7px; margin-bottom: 12px; }
.preset {
  flex: 1; padding: 9px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03); color: #94a3b8; font-size: 0.8rem; font-weight: 500;
  cursor: pointer; transition: all .15s;
}
.preset:hover { border-color: rgba(99,102,241,.5); color: #e2e8f0; background: rgba(99,102,241,.08); }

.raw-row { display: flex; gap: 8px; max-width: 100%; overflow: hidden; }
.raw-input {
  flex: 1; 
  max-width: 65%;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px; color: #e2e8f0; font-family: 'JetBrains Mono', monospace;
  font-size: 0.82rem; outline: none; transition: border-color .2s;
}
.raw-input:focus { border-color: #6366f1; }
.raw-input::placeholder { color: #475569; }
.send-btn {
  flex: 0 0 auto;
  padding: 10px 18px; border-radius: 10px; border: none;
  background: linear-gradient(135deg, #6366f1, #818cf8); color: #fff;
  font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap;
  transition: all .15s;
}
.send-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(99,102,241,.35); }

.toast {
  position: absolute; bottom: -16px; left: 50%; transform: translateX(-50%);
  background: #1a1e2a; border: 1px solid rgba(99,102,241,.3);
  color: #a5b4fc; padding: 8px 20px; border-radius: 100px;
  font-size: 0.8rem; font-weight: 500; white-space: nowrap; pointer-events: none;
}
.toast.err { border-color: rgba(239,68,68,.3); color: #f87171; }
.toast-enter-active, .toast-leave-active { transition: opacity .25s, transform .25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(6px); }
</style>
