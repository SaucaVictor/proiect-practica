<script setup lang="ts">
import { ref, computed } from "vue";
import { useScenarios, type Scenario, type Condition, type ScenarioAction } from "../composables/useScenarios";
import { useSettings } from "../composables/useSettings";

const { scenarios, addScenario, updateScenario, deleteScenario, toggleScenario } = useScenarios();
const { updateSettings } = useSettings();

const showBuilder = ref(false);
const editingId   = ref<string | null>(null);
const editingBuiltinId = ref<string | null>(null);

const form = ref({ name: "", conditions: [] as Condition[], actions: [] as ScenarioAction[] });

const SENSOR_META: Record<string, { unit: string; hint: string; defaultVal: number; hasPercent: boolean }> = {
  Light:       { unit: "%",      hint: "0 = intunecat, 100 = luminos",   defaultVal: 50,  hasPercent: true  },
  Temperature: { unit: "°C",    hint: "temperatura camerei in °C",       defaultVal: 26,  hasPercent: false },
  Persons:     { unit: "pers.", hint: "numar de persoane in camera",      defaultVal: 1,   hasPercent: false },
  Curent:      { unit: "A",     hint: "curent in Amperi",                 defaultVal: 5,   hasPercent: false },
};

const SENSORS   = Object.keys(SENSOR_META);
const OPERATORS = [">", "<", ">=", "<=", "==", "!="];
const OUTPUTS   = ["fan", "led", "ptc"];

const SENSOR_ICONS: Record<string, string> = { Light: "☀️", Temperature: "🌡️", Persons: "👥", Curent: "⚡" };
const SCENARIO_ICONS: Record<string, string> = { light_control: "💡", temperature_control: "🔥", simple: "⚙️" };
const OUTPUT_ICONS: Record<string, string> = { fan: "💨", led: "💡", ptc: "🥵" };

const builtIns = computed(() => scenarios.value.filter(s => s.type !== "simple"));
const customs  = computed(() => scenarios.value.filter(s => s.type === "simple"));

function resetForm() { form.value = { name: "", conditions: [], actions: [] }; editingId.value = null; }

function addCondition() {
  const sensor = "Light";
  const meta = SENSOR_META[sensor];
  form.value.conditions.push({ sensor, operator: ">", value: meta.defaultVal, unit: "percent" });
}

function onSensorChange(c: Condition) {
  const meta = SENSOR_META[c.sensor];
  c.value = meta.defaultVal;
  c.unit  = meta.hasPercent ? "percent" : "value";
}

function removeCondition(i: number) { form.value.conditions.splice(i, 1); }
function addAction()             { form.value.actions.push({ output: "led", value: 178 }); }
function removeAction(i: number) { form.value.actions.splice(i, 1); }

async function saveScenario() {
  if (!form.value.name.trim()) return;
  const payload = JSON.parse(JSON.stringify({
    name:       form.value.name,
    type:       "simple",
    enabled:    editingId.value ? undefined : false,
    conditions: form.value.conditions,
    actions:    form.value.actions,
  }));
  if (payload.enabled === undefined) delete payload.enabled;
  if (editingId.value) {
    await updateScenario(editingId.value, payload);
  } else {
    await addScenario({ ...payload, enabled: false });
  }
  showBuilder.value = false;
  resetForm();
}

function startEdit(s: Scenario) {
  form.value = JSON.parse(JSON.stringify({ name: s.name, conditions: s.conditions ?? [], actions: s.actions ?? [] }));
  editingId.value = s.id;
  showBuilder.value = true;
  editingBuiltinId.value = null;
}

function toggleBuiltinEdit(id: string) {
  editingBuiltinId.value = editingBuiltinId.value === id ? null : id;
}

function conditionSummary(c: Condition) {
  const unit = c.unit === "percent" ? "%" : (SENSOR_META[c.sensor]?.unit ?? "");
  return `${SENSOR_ICONS[c.sensor] ?? ""} ${c.sensor} ${c.operator} ${c.value} ${unit}`;
}

function actionSummary(a: ScenarioAction) {
  return `${OUTPUT_ICONS[a.output] ?? ""} ${a.output} → ${Math.round(a.value / 255 * 100)}%`;
}

async function updateBuiltin(id: string, field: string, val: number) {
  await updateScenario(id, { [field]: val });
  if (field === "thermostatTarget") await updateSettings({ thermostatTarget: val });
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <span class="text-xs font-bold tracking-wider uppercase text-[var(--iot-text-muted)]">Scenarii Automatizare</span>
    </div>

    <!-- Built-in scenarios grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="s in builtIns" :key="s.id" class="flex flex-col bg-[var(--iot-card-bg)] border border-[var(--iot-accent)]/20 rounded-2xl p-5 hover:border-[var(--iot-accent)]/40 transition-colors duration-200">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-xl">{{ SCENARIO_ICONS[s.type] }}</span>
          <span class="flex-1 text-sm font-bold text-[var(--iot-text)]">{{ s.name }}</span>
          <button class="px-2.5 py-1 text-[10px] font-semibold rounded border border-white/10 bg-transparent text-[var(--iot-text-muted)] hover:border-white/20 hover:text-[var(--iot-text)] cursor-pointer" title="Editeaza setarile" @click="toggleBuiltinEdit(s.id)">Config</button>
          
          <!-- Custom Toggle Pill -->
          <label class="relative inline-flex items-center cursor-pointer select-none">
            <input type="checkbox" :checked="s.enabled" @change="toggleScenario(s.id, !s.enabled)" class="sr-only peer" />
            <div class="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--iot-accent)]"></div>
          </label>
        </div>

        <!-- Light control layout -->
        <template v-if="s.type === 'light_control'">
          <p class="text-xs text-[var(--iot-text-muted)] leading-relaxed mb-3">
            &gt;{{ s.highThreshold ?? 75 }}% ambient → LED off ·
            {{ s.lowThreshold ?? 25 }}–{{ s.highThreshold ?? 75 }}% → LED {{ s.midBrightness ?? 70 }}% ·
            &lt;{{ s.lowThreshold ?? 25 }}% → LED {{ s.fullBrightness ?? 100 }}%<br/>
            Camera se goleste → LED oprit dupa <strong>{{ s.offDelay ?? 10 }}s</strong>
          </p>
          <div v-if="editingBuiltinId === s.id" class="flex flex-col gap-2 bg-[var(--iot-accent)]/5 border border-[var(--iot-accent)]/10 rounded-xl p-3 mb-2.5">
            <div class="flex items-center gap-2 text-xs"><label class="w-24 text-[var(--iot-text-muted)]">Prag maxim</label><input type="number" :value="s.highThreshold ?? 75" min="0" max="100" @change="updateBuiltin(s.id, 'highThreshold', +($event.target as HTMLInputElement).value)" class="w-16 px-1.5 py-1 text-center bg-white/5 border border-white/10 rounded text-[var(--iot-text)] outline-none focus:border-[var(--iot-accent)]" /><span class="text-[10px] text-zinc-500">% (peste prag -> LED OFF)</span></div>
            <div class="flex items-center gap-2 text-xs"><label class="w-24 text-[var(--iot-text-muted)]">Prag minim</label><input type="number" :value="s.lowThreshold ?? 25" min="0" max="100" @change="updateBuiltin(s.id, 'lowThreshold', +($event.target as HTMLInputElement).value)" class="w-16 px-1.5 py-1 text-center bg-white/5 border border-white/10 rounded text-[var(--iot-text)] outline-none focus:border-[var(--iot-accent)]" /><span class="text-[10px] text-zinc-500">% (sub prag -> LED MAX)</span></div>
            <div class="flex items-center gap-2 text-xs"><label class="w-24 text-[var(--iot-text-muted)]">Luminozitate med</label><input type="number" :value="s.midBrightness ?? 70" min="0" max="100" @change="updateBuiltin(s.id, 'midBrightness', +($event.target as HTMLInputElement).value)" class="w-16 px-1.5 py-1 text-center bg-white/5 border border-white/10 rounded text-[var(--iot-text)] outline-none focus:border-[var(--iot-accent)]" /><span class="text-[10px] text-zinc-500">% (intre praguri)</span></div>
            <div class="flex items-center gap-2 text-xs"><label class="w-24 text-[var(--iot-text-muted)]">Luminozitate max</label><input type="number" :value="s.fullBrightness ?? 100" min="0" max="100" @change="updateBuiltin(s.id, 'fullBrightness', +($event.target as HTMLInputElement).value)" class="w-16 px-1.5 py-1 text-center bg-white/5 border border-white/10 rounded text-[var(--iot-text)] outline-none focus:border-[var(--iot-accent)]" /><span class="text-[10px] text-zinc-500">% (sub pragul minim)</span></div>
            <div class="flex items-center gap-2 text-xs"><label class="w-24 text-[var(--iot-text-muted)]">Timp oprire</label><input type="number" :value="s.offDelay ?? 10" min="1" max="300" @change="updateBuiltin(s.id, 'offDelay', +($event.target as HTMLInputElement).value)" class="w-16 px-1.5 py-1 text-center bg-white/5 border border-white/10 rounded text-[var(--iot-text)] outline-none focus:border-[var(--iot-accent)]" /><span class="text-[10px] text-zinc-500">secunde dupa golirea camerei</span></div>
          </div>
        </template>

        <!-- Temperature control layout -->
        <template v-if="s.type === 'temperature_control'">
          <div class="flex items-center gap-2.5 mb-3">
            <span class="text-xs text-[var(--iot-text-muted)]">Tinta Termostat:</span>
            <input type="number" class="w-16 px-2 py-1 text-center bg-white/5 border border-white/10 rounded-xl text-[var(--iot-text)] font-semibold outline-none focus:border-[var(--iot-accent)]" :value="s.thermostatTarget ?? 22" min="10" max="35" step="0.5"
              @change="updateBuiltin(s.id, 'thermostatTarget', +($event.target as HTMLInputElement).value)" />
            <span class="text-xs text-[var(--iot-accent)]">°C</span>
          </div>
          <div v-if="editingBuiltinId === s.id" class="flex flex-col gap-2 bg-[var(--iot-accent)]/5 border border-[var(--iot-accent)]/10 rounded-xl p-3 mb-2.5">
            <div class="flex items-center gap-2 text-xs"><label class="w-24 text-[var(--iot-text-muted)]">Zona moarta</label><input type="number" :value="s.deadband ?? 0.5" min="0" max="5" step="0.1" @change="updateBuiltin(s.id, 'deadband', +($event.target as HTMLInputElement).value)" class="w-16 px-1.5 py-1 text-center bg-white/5 border border-white/10 rounded text-[var(--iot-text)] outline-none focus:border-[var(--iot-accent)]" /><span class="text-[10px] text-zinc-500">°C (fara actiune in ±aceasta)</span></div>
            <div class="flex items-center gap-2 text-xs"><label class="w-24 text-[var(--iot-text-muted)]">Putere maxima la</label><input type="number" :value="s.maxRange ?? 10" min="1" max="20" step="0.5" @change="updateBuiltin(s.id, 'maxRange', +($event.target as HTMLInputElement).value)" class="w-16 px-1.5 py-1 text-center bg-white/5 border border-white/10 rounded text-[var(--iot-text)] outline-none focus:border-[var(--iot-accent)]" /><span class="text-[10px] text-zinc-500">°C fata de tinta</span></div>
            <div class="text-[10px] text-[var(--iot-accent)]/80 italic border-t border-[var(--iot-accent)]/10 pt-2 mt-1">Modul Eco (70% putere max) activat cand sunt 1-9 persoane in camera.</div>
          </div>
        </template>

        <span class="inline-block self-start text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded" :class="[s.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-[var(--iot-text-muted)]/60']">
          {{ s.enabled ? "ACTIV" : "INACTIV" }}
        </span>
      </div>
    </div>

    <!-- Custom Scenarios -->
    <div class="flex items-center justify-between border-t border-white/5 pt-5.5">
      <span class="text-xs font-bold tracking-wider uppercase text-[var(--iot-text-muted)]">Scenarii Personalizate</span>
      <button class="px-3.5 py-1.5 rounded-lg border border-[var(--iot-accent)]/30 bg-[var(--iot-accent)]/5 text-xs text-[var(--iot-accent)] font-semibold cursor-pointer hover:bg-[var(--iot-accent)]/15 transition-all duration-200" @click="showBuilder = !showBuilder; resetForm()">
        {{ showBuilder && !editingId ? "Anulează" : "+ Nou" }}
      </button>
    </div>

    <!-- Custom Scenario Builder Form -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="showBuilder" class="bg-[var(--iot-card-bg)] border border-[var(--iot-accent)]/35 rounded-2xl p-5.5 space-y-4">
        <input v-model="form.name" class="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-[var(--iot-text)] outline-none focus:border-[var(--iot-accent)]/50 placeholder-[var(--iot-text-muted)]/40" placeholder="Numele scenariului..." />

        <!-- DACA section -->
        <div class="space-y-2.5">
          <span class="block text-[10px] font-bold tracking-wider uppercase text-[var(--iot-text-muted)]">DACA (toate conditiile sunt indeplinite)</span>
          <div class="space-y-2">
            <div v-for="(c, i) in form.conditions" :key="i" class="flex items-center gap-2 flex-wrap">
              <span class="text-sm">{{ SENSOR_ICONS[c.sensor] }}</span>
              <select v-model="c.sensor" class="bg-[var(--iot-bg-subtle)] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-[var(--iot-text)] outline-none cursor-pointer focus:border-[var(--iot-accent)]" @change="onSensorChange(c)">
                <option v-for="s in SENSORS" :key="s">{{ s }}</option>
              </select>
              <select v-model="c.operator" class="bg-[var(--iot-bg-subtle)] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-[var(--iot-text)] outline-none cursor-pointer focus:border-[var(--iot-accent)]" style="width: 55px">
                <option v-for="op in OPERATORS" :key="op">{{ op }}</option>
              </select>
              <input v-model.number="c.value" type="number" class="w-16 bg-[var(--iot-bg-subtle)] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-[var(--iot-text)] outline-none focus:border-[var(--iot-accent)]"
                :min="0" :max="c.sensor === 'Light' && c.unit === 'percent' ? 100 : (c.sensor === 'Temperature' ? 50 : 9999)" />
              
              <template v-if="c.sensor === 'Light'">
                <select v-model="c.unit" class="bg-[var(--iot-bg-subtle)] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-[var(--iot-text)] outline-none cursor-pointer focus:border-[var(--iot-accent)]">
                  <option value="percent">% (0-100)</option>
                  <option value="raw">brut (0-1023)</option>
                </select>
              </template>
              <span v-else class="text-[10px] font-bold text-[var(--iot-accent)] bg-[var(--iot-accent)]/10 px-2 py-1 rounded">{{ SENSOR_META[c.sensor]?.unit }}</span>
              <span class="text-[10px] text-[var(--iot-text-muted)] opacity-60 flex-1 min-w-[120px] truncate">{{ SENSOR_META[c.sensor]?.hint }}</span>
              <button class="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/25 border-0 cursor-pointer" @click="removeCondition(i)">✕</button>
            </div>
          </div>
          <button class="px-3 py-1.5 border border-dashed border-white/15 bg-transparent text-[10px] font-semibold text-[var(--iot-text-muted)] rounded-lg hover:border-[var(--iot-accent)] hover:text-[var(--iot-accent)] cursor-pointer transition-colors duration-200" @click="addCondition">+ Adaugă Condiție</button>
        </div>

        <!-- ATUNCI section -->
        <div class="space-y-2.5">
          <span class="block text-[10px] font-bold tracking-wider uppercase text-[var(--iot-text-muted)]">ATUNCI</span>
          <div class="space-y-2">
            <div v-for="(a, i) in form.actions" :key="i" class="flex items-center gap-3">
              <select v-model="a.output" class="bg-[var(--iot-bg-subtle)] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-[var(--iot-text)] outline-none cursor-pointer focus:border-[var(--iot-accent)]">
                <option v-for="o in OUTPUTS" :key="o">{{ o }}</option>
              </select>
              <input type="range" min="0" max="255" v-model.number="a.value" class="flex-1 h-1 bg-[var(--iot-slider-track)] rounded appearance-none cursor-pointer accent-[var(--iot-accent)]" />
              <span class="w-10 text-right text-xs font-mono text-[var(--iot-accent)]">{{ Math.round(a.value / 255 * 100) }}%</span>
              <button class="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/25 border-0 cursor-pointer" @click="removeAction(i)">✕</button>
            </div>
          </div>
          <button class="px-3 py-1.5 border border-dashed border-white/15 bg-transparent text-[10px] font-semibold text-[var(--iot-text-muted)] rounded-lg hover:border-[var(--iot-accent)] hover:text-[var(--iot-accent)] cursor-pointer transition-colors duration-200" @click="addAction">+ Adaugă Acțiune</button>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 border-t border-white/5 pt-4">
          <button class="px-4 py-2 border border-white/10 bg-transparent text-xs text-[var(--iot-text-muted)] rounded-xl cursor-pointer hover:border-white/20 transition-all duration-200" @click="showBuilder = false; resetForm()">Anulează</button>
          <button class="px-4 py-2 border-0 bg-gradient-to-r from-[var(--iot-accent)] to-[#4453e7] text-white text-xs font-semibold rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(92,114,243,0.3)] transition-all duration-200" @click="saveScenario">{{ editingId ? "Actualizează" : "Salvează Scenariul" }}</button>
        </div>
      </div>
    </Transition>

    <!-- Custom scenarios list -->
    <div v-if="customs.length" class="space-y-3">
      <div v-for="s in customs" :key="s.id" class="flex flex-col bg-[var(--iot-card-bg)] border border-white/5 rounded-2xl p-5 hover:border-[var(--iot-accent)]/20 transition-colors duration-200">
        <div class="flex items-center justify-between mb-3.5">
          <span class="text-sm font-semibold text-[var(--iot-text)]">{{ s.name }}</span>
          
          <label class="relative inline-flex items-center cursor-pointer select-none">
            <input type="checkbox" :checked="s.enabled" @change="toggleScenario(s.id, !s.enabled)" class="sr-only peer" />
            <div class="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--iot-accent)]"></div>
          </label>
        </div>

        <div class="flex flex-wrap gap-2 items-center mb-4">
          <div v-for="c in s.conditions" :key="c.sensor + c.operator + c.value" class="text-[10px] px-2.5 py-1 rounded bg-[var(--iot-accent)]/10 text-[var(--iot-accent)] font-medium">{{ conditionSummary(c) }}</div>
          <span class="text-xs text-zinc-600">→</span>
          <div v-for="a in s.actions" :key="a.output" class="text-[10px] px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 font-medium">{{ actionSummary(a) }}</div>
        </div>

        <div class="flex items-center gap-2 mt-auto">
          <button class="px-2.5 py-1 text-[10px] font-semibold rounded border border-white/10 bg-transparent text-[var(--iot-text-muted)] hover:border-white/20 hover:text-[var(--iot-text)] cursor-pointer" @click="startEdit(s)">Editare</button>
          <button class="px-2.5 py-1 text-[10px] font-semibold rounded border border-red-500/10 bg-transparent text-red-400 hover:border-red-500/20 hover:bg-red-500/5 cursor-pointer" @click="deleteScenario(s.id)">Şterge</button>
          <span class="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ml-auto" :class="[s.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-[var(--iot-text-muted)]/60']">{{ s.enabled ? "ACTIV" : "OFF" }}</span>
        </div>
      </div>
    </div>
    <div v-else-if="!showBuilder" class="text-xs text-[var(--iot-text-muted)] opacity-60 italic py-4">Niciun scenariu personalizat — apăsaţi pe + Nou pentru a crea unul.</div>
  </div>
</template>
