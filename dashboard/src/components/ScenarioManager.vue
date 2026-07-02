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

// Sensor metadata: unit label, hint, default value for conditions
const SENSOR_META: Record<string, { unit: string; hint: string; defaultVal: number; hasPercent: boolean }> = {
  Light:       { unit: "%",      hint: "0 = intunecat, 100 = luminos",   defaultVal: 50,  hasPercent: true  },
  Temperature: { unit: "°C",    hint: "temperatura camerei in °C",       defaultVal: 26,  hasPercent: false },
  Persons:     { unit: "pers.", hint: "numar de persoane in camera",      defaultVal: 1,   hasPercent: false },
  Curent:      { unit: "A",     hint: "curent in Amperi",                 defaultVal: 5,   hasPercent: false },
};

const SENSORS   = Object.keys(SENSOR_META);
const OPERATORS = [">", "<", ">=", "<=", "==", "!="];
const OUTPUTS   = ["fan", "led", "ptc"];
const SENSOR_ICONS:   Record<string, string> = { Light: "", Temperature: "", Persons: "", Curent: "" };
const SCENARIO_ICONS: Record<string, string> = { light_control: "", temperature_control: "", simple: "" };
const OUTPUT_ICONS:   Record<string, string> = { fan: "", led: "", ptc: "" };

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
  // ⚠️ JSON round-trip strips Vue reactive proxies — Firestore rejects Proxy objects
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
  // Deep-clone via JSON to avoid mutating live Firestore objects
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
  <div class="sm-root">
    <div class="sm-header">
      <span class="sm-title">Scenarii</span>
      <!-- <button class="seed-btn" @click="seedDefaults" title="Creeaza scenariile implicite">Init Implicite</button> -->
    </div>

    <!-- Built-in scenarios -->
    <div class="builtin-grid">
      <div v-for="s in builtIns" :key="s.id" class="scenario-card builtin">
        <div class="sc-top">
          <span class="sc-icon">{{ SCENARIO_ICONS[s.type] }}</span>
          <span class="sc-name">{{ s.name }}</span>
          <button class="icon-btn" title="Editeaza setarile" @click="toggleBuiltinEdit(s.id)">Editare</button>
          <label class="toggle-pill">
            <input type="checkbox" :checked="s.enabled" @change="toggleScenario(s.id, !s.enabled)" />
            <span class="pill-track"><span class="pill-thumb" /></span>
          </label>
        </div>

        <!-- Light control description + edit -->
        <template v-if="s.type === 'light_control'">
          <p class="sc-desc">
            &gt;{{ s.highThreshold ?? 75 }}% ambient → LED off ·
            {{ s.lowThreshold ?? 25 }}–{{ s.highThreshold ?? 75 }}% → LED {{ s.midBrightness ?? 70 }}% ·
            &lt;{{ s.lowThreshold ?? 25 }}% → LED {{ s.fullBrightness ?? 100 }}%<br/>
            Camera se goleste → LED oprit dupa <strong>{{ s.offDelay ?? 10 }}s</strong>
          </p>
          <div v-if="editingBuiltinId === s.id" class="builtin-edit">
            <div class="be-row"><label>Prag maxim</label><input type="number" :value="s.highThreshold ?? 75" min="0" max="100" @change="updateBuiltin(s.id, 'highThreshold', +($event.target as HTMLInputElement).value)" /><span>% (peste prag -> LED oprit)</span></div>
            <div class="be-row"><label>Prag minim</label><input type="number" :value="s.lowThreshold ?? 25" min="0" max="100" @change="updateBuiltin(s.id, 'lowThreshold', +($event.target as HTMLInputElement).value)" /><span>% (sub prag -> luminozitate maxima)</span></div>
            <div class="be-row"><label>Luminozitate medie</label><input type="number" :value="s.midBrightness ?? 70" min="0" max="100" @change="updateBuiltin(s.id, 'midBrightness', +($event.target as HTMLInputElement).value)" /><span>% (intre praguri)</span></div>
            <div class="be-row"><label>Luminozitate max</label><input type="number" :value="s.fullBrightness ?? 100" min="0" max="100" @change="updateBuiltin(s.id, 'fullBrightness', +($event.target as HTMLInputElement).value)" /><span>% (sub pragul minim)</span></div>
            <div class="be-row"><label>Timp oprire</label><input type="number" :value="s.offDelay ?? 10" min="1" max="300" @change="updateBuiltin(s.id, 'offDelay', +($event.target as HTMLInputElement).value)" /><span>secunde dupa golirea camerei</span></div>
          </div>
        </template>

        <!-- Temperature control -->
        <template v-if="s.type === 'temperature_control'">
          <div class="thermostat-row">
            <span class="th-unit">°C</span>
            <input type="number" class="th-input" :value="s.thermostatTarget ?? 22" min="10" max="35" step="0.5"
              @change="updateBuiltin(s.id, 'thermostatTarget', +($event.target as HTMLInputElement).value)" />
          </div>
          <div v-if="editingBuiltinId === s.id" class="builtin-edit">
            <div class="be-row"><label>Zona moarta</label><input type="number" :value="s.deadband ?? 0.5" min="0" max="5" step="0.1" @change="updateBuiltin(s.id, 'deadband', +($event.target as HTMLInputElement).value)" /><span>°C (fara actiune in ±aceasta)</span></div>
            <div class="be-row"><label>Putere maxima la</label><input type="number" :value="s.maxRange ?? 10" min="1" max="20" step="0.5" @change="updateBuiltin(s.id, 'maxRange', +($event.target as HTMLInputElement).value)" /><span>°C fata de tinta</span></div>
            <div class="be-row be-info">Modul eco (70% putere) se activeaza automat cand sunt 1-9 persoane in camera.</div>
          </div>
        </template>

        <span class="sc-badge" :class="{ on: s.enabled }">{{ s.enabled ? "ACTIV" : "INACTIV" }}</span>
      </div>
    </div>

    <!-- Custom scenarios -->
    <div class="custom-header">
      <span class="sm-label">Scenarii Personalizate</span>
      <button class="add-btn" @click="showBuilder = !showBuilder; resetForm()">{{ showBuilder && !editingId ? "Anuleaza" : "+ Nou" }}</button>
    </div>

    <!-- Scenario Builder -->
    <Transition name="slide">
      <div v-if="showBuilder" class="builder">
        <input v-model="form.name" class="builder-name" placeholder="Numele scenariului..." />

        <div class="builder-section">
          <span class="builder-label">DACA (toate conditiile sunt indeplinite)</span>
          <div v-for="(c, i) in form.conditions" :key="i" class="cond-row">
            <span class="cond-icon">{{ SENSOR_ICONS[c.sensor] }}</span>
            <select v-model="c.sensor" class="sel" @change="onSensorChange(c)">
              <option v-for="s in SENSORS" :key="s">{{ s }}</option>
            </select>
            <select v-model="c.operator" class="sel sel-op">
              <option v-for="op in OPERATORS" :key="op">{{ op }}</option>
            </select>
            <input v-model.number="c.value" type="number" class="val-input"
              :min="0" :max="c.sensor === 'Light' && c.unit === 'percent' ? 100 : (c.sensor === 'Temperature' ? 50 : 9999)" />
            <!-- Only Light gets % vs raw choice; others show static unit -->
            <template v-if="c.sensor === 'Light'">
              <select v-model="c.unit" class="sel sel-unit">
                <option value="percent">% (0-100)</option>
                <option value="raw">brut (0-1023)</option>
              </select>
            </template>
            <span v-else class="unit-badge">{{ SENSOR_META[c.sensor]?.unit }}</span>
            <span class="cond-hint">{{ SENSOR_META[c.sensor]?.hint }}</span>
            <button class="rm-btn" @click="removeCondition(i)">×</button>
          </div>
          <button class="ghost-btn" @click="addCondition">+ Adauga Conditie</button>
        </div>

        <div class="builder-section">
          <span class="builder-label">ATUNCI</span>
          <div v-for="(a, i) in form.actions" :key="i" class="action-row">
            <select v-model="a.output" class="sel">
              <option v-for="o in OUTPUTS" :key="o">{{ o }}</option>
            </select>
            <input type="range" min="0" max="255" v-model.number="a.value" class="action-slider" />
            <span class="action-val">{{ Math.round(a.value / 255 * 100) }}%</span>
            <button class="rm-btn" @click="removeAction(i)">×</button>
          </div>
          <button class="ghost-btn" @click="addAction">+ Adauga Actiune</button>
        </div>

        <div class="builder-footer">
          <button class="cancel-btn" @click="showBuilder = false; resetForm()">Anuleaza</button>
          <button class="save-btn" @click="saveScenario">{{ editingId ? "Actualizeaza" : "Salveaza Scenariul" }}</button>
        </div>
      </div>
    </Transition>

    <!-- Custom list -->
    <div v-if="customs.length" class="custom-list">
      <div v-for="s in customs" :key="s.id" class="scenario-card">
        <div class="sc-top">
          <span class="sc-name">{{ s.name }}</span>
          <label class="toggle-pill">
            <input type="checkbox" :checked="s.enabled" @change="toggleScenario(s.id, !s.enabled)" />
            <span class="pill-track"><span class="pill-thumb" /></span>
          </label>
        </div>
        <div class="sc-details">
          <div v-for="c in s.conditions" :key="c.sensor + c.operator + c.value" class="sc-chip cond">{{ conditionSummary(c) }}</div>
          <span class="arrow">→</span>
          <div v-for="a in s.actions" :key="a.output" class="sc-chip act">{{ actionSummary(a) }}</div>
        </div>
        <div class="sc-actions">
          <button class="icon-btn" @click="startEdit(s)">Editare</button>
          <button class="icon-btn danger" @click="deleteScenario(s.id)">Sterge</button>
          <span class="sc-badge" :class="{ on: s.enabled }">{{ s.enabled ? "ACTIV" : "OFF" }}</span>
        </div>
      </div>
    </div>
    <div v-else-if="!showBuilder" class="empty-custom">Niciun scenariu personalizat — apasati <strong>+ Nou</strong> pentru a crea unul.</div>
  </div>
</template>

<style scoped>
.sm-root { padding: 0; }
.sm-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.sm-title  { font-size:.7rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#64748b; }
.seed-btn  { font-size:.75rem; padding:5px 12px; border-radius:8px; border:1px solid rgba(99,102,241,.3); background:rgba(99,102,241,.08); color:#818cf8; cursor:pointer; transition:all .15s; }
.seed-btn:hover { background:rgba(99,102,241,.18); }

/* Built-in cards */
.builtin-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px; }
@media(max-width:700px){.builtin-grid{grid-template-columns:1fr;}}

.scenario-card {
  background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07);
  border-radius:14px; padding:16px; transition:border-color .2s;
}
.scenario-card.builtin { border-color:rgba(99,102,241,.2); }
.scenario-card:hover   { border-color:rgba(99,102,241,.35); }

.sc-top   { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.sc-icon  { font-size:1.1rem; }
.sc-name  { flex:1; font-size:.9rem; font-weight:600; color:#e2e8f0; }
.sc-desc  { font-size:.75rem; color:#64748b; line-height:1.6; margin-bottom:10px; }

/* Toggle pill */
.toggle-pill input { display:none; }
.pill-track { display:inline-flex; align-items:center; width:38px; height:20px; border-radius:10px; background:rgba(255,255,255,.1); cursor:pointer; padding:2px; transition:background .2s; }
.toggle-pill input:checked ~ .pill-track { background:#6366f1; }
.pill-thumb { width:16px; height:16px; border-radius:50%; background:#fff; transition:transform .2s; }
.toggle-pill input:checked ~ .pill-track .pill-thumb { transform:translateX(18px); }

.sc-badge { font-size:.6rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; padding:3px 8px; border-radius:6px; background:rgba(255,255,255,.05); color:#475569; }
.sc-badge.on { background:rgba(34,197,94,.15); color:#4ade80; }

/* Thermostat */
.thermostat-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.th-label  { font-size:.78rem; color:#94a3b8; }
.th-input  { width:64px; padding:6px 8px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); border-radius:8px; color:#e2e8f0; font-size:.9rem; font-weight:600; text-align:center; outline:none; }
.th-input:focus { border-color:#6366f1; }
.th-unit  { color:#64748b; font-size:.82rem; }
.th-hint  { margin-left:auto; font-size:.68rem; color:#475569; }

/* Custom */
.custom-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.sm-label { font-size:.7rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#64748b; }
.add-btn  { font-size:.78rem; padding:6px 14px; border-radius:8px; border:1px solid rgba(99,102,241,.3); background:rgba(99,102,241,.1); color:#818cf8; cursor:pointer; transition:all .15s; }
.add-btn:hover { background:rgba(99,102,241,.22); }

.custom-list { display:flex; flex-direction:column; gap:10px; }
.sc-details { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:8px; }
.sc-chip    { font-size:.72rem; padding:3px 8px; border-radius:6px; }
.sc-chip.cond { background:rgba(99,102,241,.12); color:#a5b4fc; }
.sc-chip.act  { background:rgba(34,197,94,.1);  color:#4ade80; }
.arrow      { color:#475569; font-size:.85rem; }
.sc-actions { display:flex; align-items:center; gap:8px; }
.icon-btn   { padding:4px 10px; border-radius:7px; border:1px solid rgba(255,255,255,.08); background:transparent; color:#94a3b8; cursor:pointer; font-size:.82rem; transition:all .15s; }
.icon-btn:hover  { border-color:rgba(99,102,241,.4); color:#e2e8f0; }
.icon-btn.danger:hover { border-color:rgba(239,68,68,.4); color:#f87171; }

.empty-custom { font-size:.8rem; color:#475569; padding:20px 0; }

/* Built-in editable panel */
.builtin-edit { margin:8px 0 10px; padding:12px; background:rgba(99,102,241,.05); border:1px solid rgba(99,102,241,.15); border-radius:10px; }
.be-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:.78rem; }
.be-row label { width:110px; color:#94a3b8; font-weight:500; }
.be-row input { width:64px; padding:4px 6px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); border-radius:7px; color:#e2e8f0; font-size:.82rem; text-align:center; outline:none; }
.be-row input:focus { border-color:#6366f1; }
.be-row span { color:#475569; font-size:.72rem; }
.be-info { color:#6366f1; font-size:.72rem; font-style:italic; border-top:1px solid rgba(99,102,241,.15); padding-top:6px; margin-top:2px; }

/* Builder */
.builder { background:rgba(255,255,255,.03); border:1px solid rgba(99,102,241,.25); border-radius:14px; padding:20px; margin-bottom:16px; }
.builder-name { width:100%; padding:10px 14px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:10px; color:#e2e8f0; font-size:.9rem; outline:none; margin-bottom:16px; }
.builder-name:focus { border-color:#6366f1; }
.builder-section { margin-bottom:14px; }
.builder-label   { display:block; font-size:.68rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#64748b; margin-bottom:8px; }

.cond-row, .action-row { display:flex; align-items:center; gap:6px; margin-bottom:6px; flex-wrap:wrap; }
.cond-icon   { font-size:1rem; }
.sel         { padding:5px 8px; background:#1a1e2a; border:1px solid rgba(255,255,255,.1); border-radius:8px; color:#e2e8f0; font-size:.8rem; outline:none; cursor:pointer; }
.sel-op      { width:60px; }
.sel-unit    { width:72px; }
.val-input   { width:68px; padding:5px 8px; background:#1a1e2a; border:1px solid rgba(255,255,255,.1); border-radius:8px; color:#e2e8f0; font-size:.82rem; outline:none; }
.unit-badge  { font-size:.75rem; color:#818cf8; background:rgba(99,102,241,.12); padding:3px 7px; border-radius:6px; white-space:nowrap; }
.cond-hint   { font-size:.68rem; color:#475569; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.action-slider { flex:1; accent-color:#6366f1; }
.action-val  { width:36px; text-align:right; font-size:.78rem; color:#818cf8; font-family:'JetBrains Mono',monospace; }
.rm-btn      { padding:2px 8px; border-radius:6px; border:none; background:rgba(239,68,68,.12); color:#f87171; cursor:pointer; font-size:.85rem; }
.ghost-btn   { font-size:.75rem; padding:5px 12px; border-radius:8px; border:1px dashed rgba(255,255,255,.15); background:transparent; color:#64748b; cursor:pointer; transition:all .15s; margin-top:4px; }
.ghost-btn:hover { border-color:rgba(99,102,241,.4); color:#818cf8; }

.builder-footer { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
.cancel-btn { padding:8px 18px; border-radius:10px; border:1px solid rgba(255,255,255,.1); background:transparent; color:#94a3b8; cursor:pointer; font-size:.82rem; }
.save-btn   { padding:8px 20px; border-radius:10px; border:none; background:linear-gradient(135deg,#6366f1,#818cf8); color:#fff; font-size:.82rem; font-weight:600; cursor:pointer; }
.save-btn:hover { box-shadow:0 4px 16px rgba(99,102,241,.35); }

.slide-enter-active,.slide-leave-active { transition:all .25s ease; }
.slide-enter-from,.slide-leave-to { opacity:0; transform:translateY(-8px); }
</style>
