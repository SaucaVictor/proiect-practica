<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useScenarios, type Scenario, type Condition, type ScenarioAction } from "../composables/useScenarios";
import { useSettings } from "../composables/useSettings";

const { scenarios, addScenario, updateScenario, deleteScenario, toggleScenario, seedDefaults } = useScenarios();
const { updateSettings } = useSettings();

onMounted(() => seedDefaults());

const showBuilder      = ref(false);
const editingId        = ref<string | null>(null);
const editingBuiltinId = ref<string | null>(null);
const saveError        = ref<string | null>(null);

const form = ref({ name: "", conditions: [] as Condition[], actions: [] as ScenarioAction[] });

const SENSOR_META: Record<string, { unit: string; hint: string; defaultVal: number; hasPercent: boolean }> = {
  Light:       { unit: "%",    hint: "0 = intunecat, 100 = luminos",   defaultVal: 50, hasPercent: true  },
  Temperature: { unit: "C",   hint: "temperatura camerei in grade C",  defaultVal: 26, hasPercent: false },
  Persons:     { unit: "pers",hint: "numar de persoane in camera",      defaultVal: 1,  hasPercent: false },
  Curent:      { unit: "A",   hint: "curent in Amperi",                 defaultVal: 5,  hasPercent: false },
};

const SENSORS   = Object.keys(SENSOR_META);
const OPERATORS = [">", "<", ">=", "<=", "==", "!="];
const OUTPUTS   = ["fan", "led", "ptc"];
const OUTPUT_LABELS: Record<string, string> = { fan: "Ventilator", led: "LED", ptc: "Incalzitor" };

const builtIns = computed(() => scenarios.value.filter(s => s.type !== "simple"));
const customs  = computed(() => scenarios.value.filter(s => s.type === "simple"));

function resetForm() {
  form.value = { name: "", conditions: [], actions: [] };
  editingId.value = null;
  saveError.value = null;
}

function addCondition() {
  const sensor = "Light";
  const meta   = SENSOR_META[sensor];
  form.value.conditions.push({ sensor, operator: ">", value: meta.defaultVal, unit: "percent" });
}

function onSensorChange(c: Condition) {
  const meta = SENSOR_META[c.sensor];
  c.value = meta.defaultVal;
  c.unit  = meta.hasPercent ? "percent" : "value";
}

function removeCondition(i: number) { form.value.conditions.splice(i, 1); }
function addAction()                { form.value.actions.push({ output: "led", value: 178 }); }
function removeAction(i: number)    { form.value.actions.splice(i, 1); }

async function saveScenario() {
  if (!form.value.name.trim()) return;
  saveError.value = null;
  let err: string | null = null;
  if (editingId.value) {
    err = await updateScenario(editingId.value, {
      name:       form.value.name,
      conditions: form.value.conditions,
      actions:    form.value.actions,
    });
  } else {
    err = await addScenario({
      name:       form.value.name,
      type:       "simple",
      enabled:    false,
      conditions: form.value.conditions,
      actions:    form.value.actions,
    });
  }
  if (err) {
    saveError.value = err;
    return;
  }
  showBuilder.value = false;
  resetForm();
}

function startEdit(s: Scenario) {
  form.value = JSON.parse(JSON.stringify({ name: s.name, conditions: s.conditions ?? [], actions: s.actions ?? [] }));
  editingId.value        = s.id;
  editingBuiltinId.value = null;
  showBuilder.value      = true;
  saveError.value        = null;
}

function toggleBuiltinEdit(id: string) {
  editingBuiltinId.value = editingBuiltinId.value === id ? null : id;
}

function conditionLabel(c: Condition): string {
  const unit = c.unit === "percent" ? "%" : (SENSOR_META[c.sensor]?.unit ?? "");
  return c.sensor + " " + c.operator + " " + c.value + " " + unit;
}

function actionLabel(a: ScenarioAction): string {
  return (OUTPUT_LABELS[a.output] ?? a.output) + ": " + Math.round(a.value / 255 * 100) + "%";
}

async function updateBuiltin(id: string, field: string, val: number) {
  await updateScenario(id, { [field]: val } as any);
  if (field === "thermostatTarget") await updateSettings({ thermostatTarget: val });
}

function getVal(e: Event): number {
  return +(e.target as HTMLInputElement).value;
}

function pct(val: number) { return Math.round(val / 255 * 100); }
</script>

<template>
  <div class="sm-wrap">

    <!-- Built-in Scenarios -->
    <div class="sm-section-header">
      <span class="sm-section-label">Scenarii sistem</span>
    </div>

    <div class="sm-builtin-grid">
      <div v-for="s in builtIns" :key="s.id" class="sm-builtin-card" :class="{ 'sm-builtin-card--active': s.enabled }">

        <div class="sm-builtin-header">
          <div class="sm-type-badge" :class="s.type === 'light_control' ? 'sm-type-badge--yellow' : 'sm-type-badge--red'">
            <svg v-if="s.type === 'light_control'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z"/>
            </svg>
            <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
            </svg>
          </div>
          <span class="sm-builtin-name">{{ s.name }}</span>
          <button class="sm-config-btn" @click="toggleBuiltinEdit(s.id)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07m14.14 0A10 10 0 0 0 4.93 4.93"/>
            </svg>
            Config
          </button>
          <label class="sm-toggle">
            <input type="checkbox" :checked="s.enabled" @change="toggleScenario(s.id, !s.enabled)" class="sm-toggle-input" />
            <span class="sm-toggle-rail" />
          </label>
        </div>

        <!-- Light control -->
        <template v-if="s.type === 'light_control'">
          <p class="sm-builtin-desc">
            Luminos (&gt;{{ s.highThreshold ?? 75 }}%) &rarr; LED oprit &middot;
            Mediu &rarr; LED {{ s.midBrightness ?? 70 }}% &middot;
            Intunecat (&lt;{{ s.lowThreshold ?? 25 }}%) &rarr; LED {{ s.fullBrightness ?? 100 }}%
          </p>
          <div v-if="editingBuiltinId === s.id" class="sm-builtin-editor">
            <div class="sm-editor-row">
              <label class="sm-editor-label">Prag maxim</label>
              <input type="number" :value="s.highThreshold ?? 75" min="0" max="100"
                @change="updateBuiltin(s.id, 'highThreshold', getVal($event))"
                class="sm-editor-input" />
              <span class="sm-editor-hint">%</span>
            </div>
            <div class="sm-editor-row">
              <label class="sm-editor-label">Prag minim</label>
              <input type="number" :value="s.lowThreshold ?? 25" min="0" max="100"
                @change="updateBuiltin(s.id, 'lowThreshold', getVal($event))"
                class="sm-editor-input" />
              <span class="sm-editor-hint">%</span>
            </div>
            <div class="sm-editor-row">
              <label class="sm-editor-label">Luminoz. medie</label>
              <input type="number" :value="s.midBrightness ?? 70" min="0" max="100"
                @change="updateBuiltin(s.id, 'midBrightness', getVal($event))"
                class="sm-editor-input" />
              <span class="sm-editor-hint">%</span>
            </div>
            <div class="sm-editor-row">
              <label class="sm-editor-label">Luminoz. maxima</label>
              <input type="number" :value="s.fullBrightness ?? 100" min="0" max="100"
                @change="updateBuiltin(s.id, 'fullBrightness', getVal($event))"
                class="sm-editor-input" />
              <span class="sm-editor-hint">%</span>
            </div>
            <div class="sm-editor-row">
              <label class="sm-editor-label">Timp oprire</label>
              <input type="number" :value="s.offDelay ?? 10" min="1" max="300"
                @change="updateBuiltin(s.id, 'offDelay', getVal($event))"
                class="sm-editor-input" />
              <span class="sm-editor-hint">sec</span>
            </div>
          </div>
        </template>

        <!-- Temperature control -->
        <template v-if="s.type === 'temperature_control'">
          <div class="sm-thermo-row">
            <span class="sm-builtin-desc" style="margin:0">Termostat:</span>
            <input type="number" class="sm-thermo-input"
              :value="s.thermostatTarget ?? 22" min="10" max="35" step="0.5"
              @change="updateBuiltin(s.id, 'thermostatTarget', getVal($event))" />
            <span class="sm-thermo-unit">&#176;C</span>
          </div>
          <div v-if="editingBuiltinId === s.id" class="sm-builtin-editor">
            <div class="sm-editor-row">
              <label class="sm-editor-label">Zona moarta</label>
              <input type="number" :value="s.deadband ?? 0.5" min="0" max="5" step="0.1"
                @change="updateBuiltin(s.id, 'deadband', getVal($event))"
                class="sm-editor-input" />
              <span class="sm-editor-hint">&#176;C</span>
            </div>
            <div class="sm-editor-row">
              <label class="sm-editor-label">Putere max la</label>
              <input type="number" :value="s.maxRange ?? 10" min="1" max="20" step="0.5"
                @change="updateBuiltin(s.id, 'maxRange', getVal($event))"
                class="sm-editor-input" />
              <span class="sm-editor-hint">&#176;C fata de tinta</span>
            </div>
          </div>
        </template>

        <span class="sm-status-pill" :class="s.enabled ? 'sm-status-pill--on' : 'sm-status-pill--off'">
          {{ s.enabled ? "ACTIV" : "INACTIV" }}
        </span>
      </div>
    </div>

    <!-- Custom Scenarios header -->
    <div class="sm-custom-header">
      <span class="sm-section-label">Scenarii personalizate</span>
      <button class="sm-new-btn" @click="showBuilder = !showBuilder; saveError = null; if (!showBuilder) resetForm()">
        <svg v-if="showBuilder && !editingId" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        {{ showBuilder && !editingId ? "Anuleaza" : "Nou scenariu" }}
      </button>
    </div>

    <!-- Builder Form -->
    <Transition
      enter-active-class="sm-transition-enter-active"
      enter-from-class="sm-transition-enter-from"
      leave-active-class="sm-transition-leave-active"
      leave-to-class="sm-transition-leave-to"
    >
      <div v-if="showBuilder" class="sm-builder">
        <input v-model="form.name" class="sm-builder-name" placeholder="Numele scenariului..." />

        <!-- Conditions -->
        <div class="sm-builder-section">
          <span class="sm-builder-section-label">DACA (toate conditiile sunt indeplinite)</span>
          <div class="sm-conditions">
            <div v-for="(c, i) in form.conditions" :key="i" class="sm-condition-row">
              <select v-model="c.sensor" class="sm-select" @change="onSensorChange(c)">
                <option v-for="s in SENSORS" :key="s">{{ s }}</option>
              </select>
              <select v-model="c.operator" class="sm-select sm-select--op">
                <option v-for="op in OPERATORS" :key="op">{{ op }}</option>
              </select>
              <input v-model.number="c.value" type="number" class="sm-input-num"
                :min="0" :max="c.sensor === 'Light' && c.unit === 'percent' ? 100 : (c.sensor === 'Temperature' ? 50 : 9999)" />
              <select v-if="c.sensor === 'Light'" v-model="c.unit" class="sm-select sm-select--unit">
                <option value="percent">%</option>
                <option value="raw">brut</option>
              </select>
              <span v-else class="sm-unit-badge">{{ SENSOR_META[c.sensor]?.unit }}</span>
              <button class="sm-remove-btn" @click="removeCondition(i)">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          <button class="sm-add-btn" @click="addCondition">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Adauga conditie
          </button>
        </div>

        <!-- Actions -->
        <div class="sm-builder-section">
          <span class="sm-builder-section-label">ATUNCI</span>
          <div class="sm-conditions">
            <div v-for="(a, i) in form.actions" :key="i" class="sm-action-row">
              <select v-model="a.output" class="sm-select">
                <option v-for="o in OUTPUTS" :key="o" :value="o">{{ OUTPUT_LABELS[o] }}</option>
              </select>
              <input type="range" min="0" max="255" v-model.number="a.value" class="sm-range" />
              <span class="sm-range-val">{{ pct(a.value) }}%</span>
              <button class="sm-remove-btn" @click="removeAction(i)">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          <button class="sm-add-btn" @click="addAction">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Adauga actiune
          </button>
        </div>

        <!-- Footer -->
        <div v-if="saveError" class="sm-save-error">Eroare: {{ saveError }}</div>
        <div class="sm-builder-footer">
          <button class="sm-cancel-btn" @click="showBuilder = false; resetForm()">Anuleaza</button>
          <button class="sm-save-btn" @click="saveScenario">{{ editingId ? "Actualizeaza" : "Salveaza" }}</button>
        </div>
      </div>
    </Transition>

    <!-- Custom list -->
    <div v-if="customs.length" class="sm-custom-list">
      <div v-for="s in customs" :key="s.id" class="sm-custom-card">
        <div class="sm-custom-card-header">
          <span class="sm-custom-name">{{ s.name }}</span>
          <label class="sm-toggle">
            <input type="checkbox" :checked="s.enabled" @change="toggleScenario(s.id, !s.enabled)" class="sm-toggle-input" />
            <span class="sm-toggle-rail" />
          </label>
        </div>

        <div class="sm-chips">
          <template v-if="s.conditions.length">
            <div v-for="c in s.conditions" :key="c.sensor + c.operator + c.value" class="sm-chip sm-chip--cond">{{ conditionLabel(c) }}</div>
            <span class="sm-chip-arrow">&rarr;</span>
          </template>
          <div v-for="a in s.actions" :key="a.output" class="sm-chip sm-chip--action">{{ actionLabel(a) }}</div>
        </div>

        <div class="sm-custom-footer">
          <button class="sm-edit-btn" @click="startEdit(s)">Editare</button>
          <button class="sm-delete-btn" @click="deleteScenario(s.id)">Sterge</button>
          <span class="sm-status-pill sm-status-pill--sm" :class="s.enabled ? 'sm-status-pill--on' : 'sm-status-pill--off'">
            {{ s.enabled ? "ACTIV" : "OFF" }}
          </span>
        </div>
      </div>
    </div>
    <div v-else-if="!showBuilder" class="sm-empty">
      Niciun scenariu personalizat - apasati pe "Nou scenariu" pentru a crea unul.
    </div>
  </div>
</template>

<style scoped>
.sm-wrap { display: flex; flex-direction: column; gap: 16px; }

.sm-section-header { display: flex; align-items: center; }
.sm-custom-header  { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid var(--iot-border); }
.sm-section-label {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--iot-text-muted);
}

.sm-builtin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 600px) { .sm-builtin-grid { grid-template-columns: 1fr; } }

.sm-builtin-card {
  background: var(--iot-surface);
  border: 1px solid var(--iot-border);
  border-radius: 14px; padding: 16px;
  transition: border-color 0.2s;
  display: flex; flex-direction: column; gap: 8px;
}
.sm-builtin-card--active { border-color: var(--iot-accent-border); }

.sm-builtin-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sm-type-badge {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
}
.sm-type-badge--yellow { background: rgba(245,158,11,0.12); color: #f59e0b; }
.sm-type-badge--red    { background: rgba(239,68,68,0.12);  color: var(--iot-danger); }
.sm-builtin-name { font-size: 13px; font-weight: 600; color: var(--iot-text); flex: 1; }

.sm-config-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 6px;
  border: 1px solid var(--iot-border); background: transparent;
  font-size: 10px; font-weight: 600; color: var(--iot-text-muted);
  cursor: pointer; transition: all 0.15s;
}
.sm-config-btn:hover { border-color: var(--iot-border-hover); color: var(--iot-text); }

.sm-builtin-desc { font-size: 11px; color: var(--iot-text-muted); line-height: 1.6; margin: 0; }

.sm-builtin-editor {
  background: var(--iot-accent-subtle);
  border: 1px solid var(--iot-accent-border);
  border-radius: 10px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.sm-editor-row { display: flex; align-items: center; gap: 8px; }
.sm-editor-label { font-size: 11px; color: var(--iot-text-muted); width: 110px; flex-shrink: 0; }
.sm-editor-input {
  width: 60px; padding: 3px 8px; text-align: center;
  background: var(--iot-surface-raised); border: 1px solid var(--iot-border);
  border-radius: 6px; font-size: 11px; color: var(--iot-text); outline: none;
}
.sm-editor-input:focus { border-color: var(--iot-accent-border); }
.sm-editor-hint { font-size: 10px; color: var(--iot-text-dim); }

.sm-thermo-row { display: flex; align-items: center; gap: 8px; }
.sm-thermo-input {
  width: 56px; padding: 4px 8px; text-align: center;
  background: var(--iot-surface-raised); border: 1px solid var(--iot-border);
  border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--iot-text); outline: none;
}
.sm-thermo-input:focus { border-color: var(--iot-accent-border); }
.sm-thermo-unit { font-size: 13px; font-weight: 600; color: var(--iot-accent); }

.sm-toggle { position: relative; display: inline-flex; cursor: pointer; }
.sm-toggle-input { position: absolute; opacity: 0; width: 0; height: 0; }
.sm-toggle-rail {
  width: 34px; height: 18px; border-radius: 99px;
  background: var(--iot-toggle-bg); transition: background 0.2s; position: relative;
}
.sm-toggle-rail::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%;
  background: white; transition: transform 0.2s ease;
}
.sm-toggle-input:checked + .sm-toggle-rail { background: var(--iot-accent); }
.sm-toggle-input:checked + .sm-toggle-rail::after { transform: translateX(16px); }

.sm-status-pill {
  display: inline-block; align-self: flex-start;
  font-size: 9px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  padding: 3px 8px; border-radius: 4px;
}
.sm-status-pill--sm { margin-left: auto; }
.sm-status-pill--on  { background: var(--iot-success-subtle); color: var(--iot-success); }
.sm-status-pill--off { background: var(--iot-surface); color: var(--iot-text-dim); }

.sm-new-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 8px;
  border: 1px solid var(--iot-accent-border);
  background: var(--iot-accent-subtle);
  font-size: 11px; font-weight: 600; color: var(--iot-accent);
  cursor: pointer; transition: all 0.15s;
}
.sm-new-btn:hover { background: rgba(92,114,243,0.15); }

.sm-builder {
  background: var(--iot-surface);
  border: 1px solid var(--iot-accent-border);
  border-radius: 14px; padding: 18px;
  display: flex; flex-direction: column; gap: 16px;
}
.sm-builder-name {
  width: 100%; background: var(--iot-card-bg);
  border: 1px solid var(--iot-border); border-radius: 10px;
  padding: 9px 13px; font-size: 12px; color: var(--iot-text); outline: none;
  transition: border-color 0.15s; box-sizing: border-box;
}
.sm-builder-name::placeholder { color: var(--iot-text-dim); }
.sm-builder-name:focus { border-color: var(--iot-accent-border); }

.sm-builder-section { display: flex; flex-direction: column; gap: 8px; }
.sm-builder-section-label {
  font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--iot-text-muted);
}

.sm-conditions { display: flex; flex-direction: column; gap: 6px; }
.sm-condition-row, .sm-action-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.sm-select, .sm-input-num {
  background: var(--iot-card-bg); border: 1px solid var(--iot-border);
  border-radius: 7px; padding: 5px 8px;
  font-size: 11px; color: var(--iot-text); outline: none; cursor: pointer;
  transition: border-color 0.15s;
}
.sm-select:focus, .sm-input-num:focus { border-color: var(--iot-accent-border); }
.sm-select--op   { width: 52px; }
.sm-select--unit { width: 64px; }
.sm-input-num    { width: 60px; }

.sm-unit-badge {
  font-size: 10px; font-weight: 700; color: var(--iot-accent);
  background: var(--iot-accent-subtle); padding: 4px 8px; border-radius: 5px;
}

.sm-range { flex: 1; min-width: 80px; accent-color: var(--iot-accent); cursor: pointer; }
.sm-range-val { font-size: 11px; font-family: monospace; color: var(--iot-accent); width: 34px; text-align: right; }

.sm-remove-btn {
  width: 22px; height: 22px; border-radius: 6px; border: none; flex-shrink: 0;
  background: var(--iot-danger-subtle); color: var(--iot-danger);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.sm-remove-btn:hover { background: rgba(239,68,68,0.2); }

.sm-add-btn {
  display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px;
  border: 1px dashed var(--iot-border-hover); border-radius: 7px; background: transparent;
  font-size: 10px; font-weight: 600; color: var(--iot-text-muted);
  cursor: pointer; transition: all 0.15s; align-self: flex-start;
}
.sm-add-btn:hover { border-color: var(--iot-accent-border); color: var(--iot-accent); }

.sm-save-error {
  font-size: 11px; color: var(--iot-danger);
  background: var(--iot-danger-subtle); border: 1px solid var(--iot-danger-border);
  border-radius: 8px; padding: 8px 12px;
}
.sm-builder-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding-top: 12px; border-top: 1px solid var(--iot-border);
}
.sm-cancel-btn {
  padding: 7px 16px; border-radius: 9px;
  border: 1px solid var(--iot-border); background: transparent;
  font-size: 12px; color: var(--iot-text-muted); cursor: pointer; transition: all 0.15s;
}
.sm-cancel-btn:hover { border-color: var(--iot-border-hover); color: var(--iot-text); }
.sm-save-btn {
  padding: 7px 20px; border-radius: 9px; border: none;
  background: linear-gradient(135deg, var(--iot-accent), var(--iot-accent-hover));
  color: white; font-size: 12px; font-weight: 600; cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}
.sm-save-btn:hover { opacity: 0.88; transform: translateY(-1px); }

.sm-custom-list { display: flex; flex-direction: column; gap: 8px; }
.sm-custom-card {
  background: var(--iot-surface); border: 1px solid var(--iot-border);
  border-radius: 12px; padding: 14px; transition: border-color 0.2s;
}
.sm-custom-card:hover { border-color: var(--iot-accent-border); }
.sm-custom-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.sm-custom-name { font-size: 13px; font-weight: 600; color: var(--iot-text); }

.sm-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 12px; }
.sm-chip { font-size: 10px; font-weight: 500; padding: 3px 8px; border-radius: 5px; }
.sm-chip--cond   { background: var(--iot-accent-subtle); color: var(--iot-accent); }
.sm-chip--action { background: var(--iot-success-subtle); color: var(--iot-success); }
.sm-chip-arrow   { font-size: 12px; color: var(--iot-text-dim); }

.sm-custom-footer { display: flex; align-items: center; gap: 6px; }
.sm-edit-btn, .sm-delete-btn {
  padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s;
}
.sm-edit-btn   { border: 1px solid var(--iot-border); background: transparent; color: var(--iot-text-muted); }
.sm-edit-btn:hover   { border-color: var(--iot-border-hover); color: var(--iot-text); }
.sm-delete-btn { border: 1px solid var(--iot-danger-border); background: transparent; color: var(--iot-danger); }
.sm-delete-btn:hover { background: var(--iot-danger-subtle); }

.sm-empty { font-size: 12px; color: var(--iot-text-dim); font-style: italic; padding: 16px 0; text-align: center; }

.sm-transition-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.sm-transition-enter-from   { opacity: 0; transform: translateY(-6px); }
.sm-transition-leave-active { transition: opacity 0.15s ease; }
.sm-transition-leave-to     { opacity: 0; }
</style>