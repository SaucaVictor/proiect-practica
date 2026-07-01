<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { Chart, registerables } from "chart.js";
import { useHistoricalReadings } from "../composables/useHistoricalReadings";
import { collection, query, orderBy, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

Chart.register(...registerables);

const period = ref<"1h" | "6h" | "24h" | "7d" | "all">("1h");

const periods = [
  { value: "1h",  label: "1 Oră" },
  { value: "6h",  label: "6 Ore" },
  { value: "24h", label: "24 Ore" },
  { value: "7d",  label: "7 Zile" },
  { value: "all", label: "Toate" },
] as const;

// Define sensors configuration
const SENSORS_CFG = {
  Temperature: { label: "Temperatură", color: "#ef4444", unit: "°C",    yAxis: "y-temp" },
  Curent:      { label: "Curent",       color: "#3b82f6", unit: " A",    yAxis: "y-current" },
  Light:       { label: "Lumină",       color: "#eab308", unit: "",       yAxis: "y-light" },
  Persons:     { label: "Persoane",     color: "#10b981", unit: " pers.", yAxis: "y-persons" },
} as const;

type SensorKey = keyof typeof SENSORS_CFG;

const activeSensors = ref<Record<SensorKey, boolean>>({
  Temperature: true,
  Curent: true,
  Light: false,
  Persons: false,
});

// Load historical data for all 4 sensors
const tempQuery = useHistoricalReadings("Temperature", period);
const currQuery = useHistoricalReadings("Curent", period);
const lightQuery = useHistoricalReadings("Light", period);
const persQuery = useHistoricalReadings("Persons", period);

const queries = {
  Temperature: tempQuery,
  Curent: currQuery,
  Light: lightQuery,
  Persons: persQuery,
};

const canvas = ref<HTMLCanvasElement>();
let chart: Chart | null = null;

const frozenReadings = ref<Record<SensorKey, any[]>>({
  Temperature: [],
  Curent: [],
  Light: [],
  Persons: [],
});

const frozenRawReadings = ref<Record<SensorKey, any[]>>({
  Temperature: [],
  Curent: [],
  Light: [],
  Persons: [],
});

const frozenStats = ref<Record<SensorKey, { min: number; max: number; avg: number }>>({
  Temperature: { min: 0, max: 0, avg: 0 },
  Curent:      { min: 0, max: 0, avg: 0 },
  Light:       { min: 0, max: 0, avg: 0 },
  Persons:     { min: 0, max: 0, avg: 0 },
});

// Pause state — when paused, live updates stop flowing into the chart
const isPaused = ref(false);

function syncLiveToFrozen() {
  (Object.keys(queries) as SensorKey[]).forEach(k => {
    frozenReadings.value[k] = [...queries[k].readings.value];
    frozenRawReadings.value[k] = [...queries[k].rawReadings.value];
    frozenStats.value[k] = { ...queries[k].stats.value };
  });
}

// Watch live streams; only push to chart when not paused
watch(
  [
    tempQuery.readings,
    currQuery.readings,
    lightQuery.readings,
    persQuery.readings,
  ],
  () => {
    if (!isPaused.value) {
      syncLiveToFrozen();
    }
  },
  { deep: true }
);

function togglePause() {
  isPaused.value = !isPaused.value;
  if (!isPaused.value) {
    // Resuming — flush latest data into chart immediately
    syncLiveToFrozen();
    updateChart();
  }
}

// Table pagination
const selectedLogSensor = ref<SensorKey>("Temperature");
const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = 8;

const rawLogs = computed(() => {
  const data = frozenRawReadings.value[selectedLogSensor.value];
  return [...data].reverse();
});

const filteredLogs = computed(() => {
  if (!searchQuery.value.trim()) return rawLogs.value;
  const q = searchQuery.value.toLowerCase();
  return rawLogs.value.filter(log => {
    const timeStr = log.timestamp?.toDate().toLocaleString().toLowerCase() ?? "";
    const valStr = log.value.toString();
    return timeStr.includes(q) || valStr.includes(q);
  });
});

const totalPages = computed(() => Math.ceil(filteredLogs.value.length / itemsPerPage));
const paginatedLogs = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredLogs.value.slice(start, start + itemsPerPage);
});

watch(selectedLogSensor, () => {
  currentPage.value = 1;
});

function buildChart() {
  if (!canvas.value) return;
  const ctx = canvas.value.getContext("2d")!;

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111827",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          padding: 12,
          titleColor: "#94a3b8",
          bodyColor: "#e2e8f0",
          titleFont: { family: "Inter", weight: "bold" },
          bodyFont: { family: "Inter" },
          callbacks: {
            label: (c) => {
              const dataset = c.dataset;
              const key = dataset.label as SensorKey;
              const cfg = SENSORS_CFG[key];
              return ` ${cfg.label}: ${(c.parsed.y ?? 0).toFixed(2)}${cfg.unit}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.03)" },
          ticks: {
            color: "#64748b",
            font: { size: 10, family: "Inter" },
            maxTicksLimit: 10,
          }
        },
        "y-temp": {
          type: "linear",
          display: activeSensors.value.Temperature,
          position: "left",
          grid: { color: "rgba(239, 68, 68, 0.05)" },
          ticks: { color: "#ef4444", font: { size: 9 } },
          title: { display: true, text: "Temp (°C)", color: "#ef4444", font: { size: 10, weight: "bold" } }
        },
        "y-current": {
          type: "linear",
          display: activeSensors.value.Curent,
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#3b82f6", font: { size: 9 } },
          title: { display: true, text: "Curent (A)", color: "#3b82f6", font: { size: 10, weight: "bold" } }
        },
        "y-light": {
          type: "linear",
          display: activeSensors.value.Light,
          position: "left",
          grid: { drawOnChartArea: false },
          ticks: { color: "#eab308", font: { size: 9 } },
          title: { display: true, text: "Lumină", color: "#eab308", font: { size: 10, weight: "bold" } }
        },
        "y-persons": {
          type: "linear",
          display: activeSensors.value.Persons,
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#10b981", font: { size: 9 } },
          title: { display: true, text: "Persoane", color: "#10b981", font: { size: 10, weight: "bold" } }
        }
      }
    }
  });
}

function updateChart() {
  if (!chart) return;

  const datasets: any[] = [];
  let labels: string[] = [];

  // Gather labels from the first visible sensor's dataset
  const firstActive = (Object.keys(activeSensors.value) as SensorKey[]).find(k => activeSensors.value[k]);
  if (firstActive) {
    labels = frozenReadings.value[firstActive].map(r => {
      if (!r.timestamp) return "";
      const d = r.timestamp.toDate();
      if (period.value === "1h" || period.value === "6h") {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }
      return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    });
  }

  // Build datasets
  (Object.keys(SENSORS_CFG) as SensorKey[]).forEach(key => {
    const active = activeSensors.value[key];
    const cfg = SENSORS_CFG[key];
    
    // Dynamically toggle scales visibility
    if (chart!.options.scales?.[cfg.yAxis]) {
      (chart!.options.scales[cfg.yAxis] as any).display = active;
    }

    if (!active) return;

    const data = frozenReadings.value[key].map(r => r.value);
    
    // Create soft gradient for backgrounds
    const canvasEl = canvas.value;
    let bg = "transparent";
    if (canvasEl) {
      const ctx = canvasEl.getContext("2d")!;
      const grad = ctx.createLinearGradient(0, 0, 0, 300);
      grad.addColorStop(0, cfg.color + "22");
      grad.addColorStop(1, cfg.color + "00");
      bg = grad as any;
    }

    datasets.push({
      label: key,
      data,
      borderColor: cfg.color,
      backgroundColor: bg,
      borderWidth: 2.5,
      tension: 0.35,
      fill: true,
      yAxisID: cfg.yAxis,
      pointRadius: 1,
      pointHoverRadius: 4,
      pointBackgroundColor: cfg.color,
      pointBorderColor: "transparent",
    });
  });

  chart.data.labels = labels;
  chart.data.datasets = datasets;
  chart.update();
}

// Watch local variables to update chart safely
watch(
  [
    frozenReadings,
    activeSensors,
    period
  ],
  () => {
    updateChart();
  },
  { deep: true }
);

const isExporting = ref(false);

async function exportToCSV() {
  const activeKeys = (Object.keys(activeSensors.value) as SensorKey[]).filter(
    k => activeSensors.value[k]
  );

  if (activeKeys.length === 0) {
    alert("Activeaza cel putin un senzor pentru export.");
    return;
  }

  isExporting.value = true;

  try {
    // Compute cutoff timestamp from selected period
    const periodMs: Record<string, number> = {
      "1h":  1 * 60 * 60 * 1000,
      "6h":  6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d":  7 * 24 * 60 * 60 * 1000,
    };
    const cutoff = periodMs[period.value]
      ? Timestamp.fromMillis(Date.now() - periodMs[period.value])
      : null; // null = "all time", no filter

    const periodLabels: Record<string, string> = {
      "1h": "Ultima Ora", "6h": "Ultimele 6 Ore", "24h": "Ultimele 24 Ore",
      "7d": "Ultimele 7 Zile", "all": "Toate Datele",
    };

    const rows: string[][] = [];
    rows.push(["Export Telemetrie IoT"]);
    rows.push(["Perioada", periodLabels[period.value] ?? period.value]);
    rows.push(["Exportat La", new Date().toLocaleString()]);
    rows.push(["Senzori", activeKeys.map(k => SENSORS_CFG[k].label).join(", ")]);
    rows.push([]);
    rows.push(["#", "Marca Timp", "Data", "Ora", "Senzor", "Valoare", "Unitate"]);

    let rowIndex = 1;

    // Fetch ALL records in the period for each active sensor — no artificial limit
    for (const key of activeKeys) {
      const cfg = SENSORS_CFG[key];
      const colRef = collection(db, "sensors", key, "readings");
      const q = cutoff
        ? query(colRef, where("timestamp", ">=", cutoff), orderBy("timestamp", "asc"))
        : query(colRef, orderBy("timestamp", "asc"));

      const snap = await getDocs(q);

      snap.forEach(docSnap => {
        const r = docSnap.data();
        const d: Date | null = r.timestamp?.toDate() ?? null;
        rows.push([
          String(rowIndex++),
          d ? d.toLocaleString() : "",
          d ? d.toLocaleDateString() : "",
          d ? d.toLocaleTimeString() : "",
          cfg.label,
          typeof r.value === "number" ? r.value.toFixed(4) : String(r.value),
          cfg.unit.trim(),
        ]);
      });
    }

    if (rowIndex === 1) {
      alert("Nu s-au gasit date pentru senzorii si intervalul selectat.");
      return;
    }

    // Build CSV using Blob — avoids the encodeURI 2MB browser limit
    const csvText = rows
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `classroom_telemetry_${period.value}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error("[exportToCSV]", err);
    alert("Export esuat. Verifica consola pentru detalii.");
  } finally {
    isExporting.value = false;
  }
}

onMounted(() => {
  syncLiveToFrozen();
  buildChart();
  updateChart();
});

onUnmounted(() => {
  chart?.destroy();
});
</script>

<template>
  <div class="analytics-root">
    
    <!-- Timeframe Selection & Sensor toggles -->
    <div class="controls-row">
      <!-- Period Selector -->
      <div class="period-selector">
        <button
          v-for="p in periods"
          :key="p.value"
          class="period-btn"
          :class="{ active: period === p.value }"
          @click="period = p.value"
        >
          {{ p.label }}
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button
          class="action-btn pause-btn"
          :class="{ paused: isPaused }"
          @click="togglePause"
        >
          <span>{{ isPaused ? 'Reia Fluxul' : 'Pauza Flux' }}</span>
        </button>
        <button
          class="action-btn export-btn"
          :disabled="isExporting"
          @click="exportToCSV"
        >
          <span>{{ isExporting ? 'Se incarca...' : 'Export CSV' }}</span>
        </button>
      </div>

      <!-- Sensor Overlays -->
      <div class="overlays-selector">
        <label
          v-for="(cfg, key) in SENSORS_CFG"
          :key="key"
          class="overlay-check"
          :style="{ '--color': cfg.color }"
          :class="{ checked: activeSensors[key] }"
        >
          <input type="checkbox" v-model="activeSensors[key]" />
          <span class="indicator-dot" />
          <span class="check-label">{{ cfg.label }}</span>
        </label>
      </div>
    </div>

    <!-- Aggregations Grid -->
    <div class="stats-grid">
      <div
        v-for="(cfg, key) in SENSORS_CFG"
        :key="key"
        class="stat-box"
        :style="{ '--color': cfg.color }"
        :class="{ dimmed: !activeSensors[key] }"
      >
        <div class="stat-header">
          <span class="stat-title">{{ cfg.label }}</span>
          <span class="stat-indicator" />
        </div>
        
        <div class="stat-values" v-if="!queries[key].loading.value">
          <div class="val-row main-val">
            <span class="lbl">Med</span>
            <span class="val">{{ frozenStats[key].avg.toFixed(1) }}<em>{{ cfg.unit }}</em></span>
          </div>
          <div class="min-max-row">
            <div class="val-row">
              <span class="lbl">Min</span>
              <span class="val">{{ frozenStats[key].min.toFixed(1) }}<em>{{ cfg.unit }}</em></span>
            </div>
            <div class="val-row">
              <span class="lbl">Max</span>
              <span class="val">{{ frozenStats[key].max.toFixed(1) }}<em>{{ cfg.unit }}</em></span>
            </div>
          </div>
        </div>
        <div class="stat-values loader" v-else>
          <span class="loading-spinner" />
          <span>Se incarca statistici…</span>
        </div>
      </div>
    </div>

    <!-- Large Correlation Graph -->
    <div class="chart-container">
      <div class="container-header">
        <span class="title">Tendinte Telemetrie Istorica</span>
        <span class="subtitle">Grafic de corelatie dinamica multi-ax</span>
      </div>
      <div class="chart-canvas-wrap">
        <canvas ref="canvas" />
      </div>
    </div>

    <!-- Raw Data Logs Table -->
    <div class="logs-container">
      <div class="logs-header">
        <div class="lh-left">
          <span class="title">Jurnal Telemetrie</span>
          <span class="subtitle">Inregistrari din baza de date</span>
        </div>

        <div class="lh-right">
          <!-- Dropdown -->
          <select v-model="selectedLogSensor" class="sensor-dropdown">
            <option v-for="(cfg, key) in SENSORS_CFG" :key="key" :value="key">
              {{ cfg.label }}
            </option>
          </select>
          <!-- Search -->
          <input
            v-model="searchQuery"
            class="table-search"
            placeholder="Cauta inregistrari..."
            spellcheck="false"
          />
        </div>
      </div>

      <div class="table-wrap">
        <table class="logs-table">
          <thead>
            <tr>
              <th>Marca de Timp</th>
              <th>Metric Senzor</th>
              <th class="r-align">Valoare Citita</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(log, idx) in paginatedLogs" :key="idx">
              <td>{{ log.timestamp?.toDate().toLocaleString() ?? "In asteptare…" }}</td>
              <td>
                <span
                  class="sensor-pill"
                  :style="{ color: SENSORS_CFG[selectedLogSensor].color, background: SENSORS_CFG[selectedLogSensor].color + '15' }"
                >
                  {{ SENSORS_CFG[selectedLogSensor].label }}
                </span>
              </td>
              <td class="r-align bold font-mono">
                {{ log.value.toFixed(2) }}<span class="table-unit">{{ SENSORS_CFG[selectedLogSensor].unit }}</span>
              </td>
            </tr>
            <tr v-if="filteredLogs.length === 0">
              <td colspan="3" class="table-empty">Niciun jurnal de telemetrie gasit.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="table-footer" v-if="totalPages > 1">
        <span class="records-count">{{ filteredLogs.length }} inregistrari</span>
        <div class="pagination">
          <button
            class="pg-btn"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            ◀
          </button>
          <span class="pg-info">Pagina {{ currentPage }} din {{ totalPages }}</span>
          <button
            class="pg-btn"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            ▶
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.analytics-root {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Time & Filter Row */
.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.period-selector {
  display: flex;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 4px;
}
.period-btn {
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-radius: 9px;
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.period-btn:hover {
  color: #f1f5f9;
}
.period-btn.active {
  background: rgba(6, 182, 212, 0.12);
  border: 1px solid rgba(6, 182, 212, 0.3);
  color: #22d3ee;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 10px;
  align-items: center;
}
.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: #94a3b8;
}
.action-btn:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #f1f5f9;
  border-color: rgba(255, 255, 255, 0.1);
}
.pause-btn.paused {
  background: rgba(234, 179, 8, 0.08);
  border-color: rgba(234, 179, 8, 0.25);
  color: #fbbf24;
}
.pause-btn.paused:hover {
  background: rgba(234, 179, 8, 0.12);
  color: #fef08a;
}
.export-btn {
  background: rgba(6, 182, 212, 0.06);
  border-color: rgba(6, 182, 212, 0.2);
  color: #22d3ee;
}
.export-btn:hover {
  background: rgba(6, 182, 212, 0.12);
  color: #67e8f9;
  border-color: rgba(6, 182, 212, 0.3);
}

.overlays-selector {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.overlay-check {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}
.overlay-check input {
  display: none;
}
.indicator-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #475569;
  transition: background 0.2s, box-shadow 0.2s;
}
.overlay-check.checked {
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--color);
  color: #e2e8f0;
}
.overlay-check.checked .indicator-dot {
  background: var(--color);
  box-shadow: 0 0 8px var(--color);
}

/* Stats Cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
@media (max-width: 980px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 580px) {
  .stats-grid { grid-template-columns: 1fr; }
}

.stat-box {
  background: rgba(17, 24, 39, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-left: 3px solid var(--color);
  border-radius: 16px;
  padding: 16px 20px;
  backdrop-filter: blur(12px);
  transition: transform 0.2s, border-color 0.2s, opacity 0.2s;
}
.stat-box.dimmed {
  opacity: 0.5;
}
.stat-box:hover {
  transform: translateY(-2px);
  border-color: var(--color);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
}
.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.stat-title {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}
.stat-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color);
}
.stat-values {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.stat-values.loader {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  font-size: 0.76rem;
  color: #475569;
  padding: 10px 0;
}
.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.05);
  border-top-color: #22d3ee;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.val-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.val-row .lbl {
  font-size: 0.72rem;
  color: #475569;
  font-weight: 500;
}
.val-row .val {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  color: #e2e8f0;
}
.val-row .val em {
  font-style: normal;
  font-size: 0.7rem;
  color: #64748b;
  margin-left: 2px;
  font-weight: 500;
}
.main-val .val {
  font-size: 1.35rem;
  color: #f1f5f9;
}
.min-max-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  padding-top: 8px;
}
.min-max-row .val {
  font-size: 0.85rem;
}

/* Chart Container */
.chart-container {
  background: rgba(17, 24, 39, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 24px;
  backdrop-filter: blur(16px);
}
.container-header {
  margin-bottom: 20px;
}
.container-header .title {
  display: block;
  font-size: 1rem;
  font-weight: 700;
  color: #f1f5f9;
}
.container-header .subtitle {
  font-size: 0.74rem;
  color: #64748b;
  margin-top: 2px;
  display: block;
}
.chart-canvas-wrap {
  height: 340px;
  position: relative;
}

/* Raw Logs Container */
.logs-container {
  background: rgba(17, 24, 39, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 24px;
  backdrop-filter: blur(16px);
}
.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}
.logs-header .title {
  display: block;
  font-size: 0.95rem;
  font-weight: 700;
  color: #f1f5f9;
}
.logs-header .subtitle {
  font-size: 0.74rem;
  color: #64748b;
  margin-top: 2px;
  display: block;
}

.lh-right {
  display: flex;
  gap: 10px;
}
.sensor-dropdown {
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  color: #e2e8f0;
  font-size: 0.8rem;
  font-weight: 600;
  outline: none;
  cursor: pointer;
}
.sensor-dropdown option {
  background: #111827;
  color: #e2e8f0;
}
.table-search {
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  color: #e2e8f0;
  font-size: 0.8rem;
  outline: none;
  width: 200px;
  transition: border-color 0.2s;
}
.table-search:focus {
  border-color: #22d3ee;
}

.table-wrap {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.logs-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.8rem;
}
.logs-table th {
  background: rgba(255, 255, 255, 0.02);
  color: #64748b;
  font-weight: 600;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.logs-table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  color: #94a3b8;
}
.logs-table tr:last-child td {
  border-bottom: none;
}
.logs-table tr:hover td {
  background: rgba(255, 255, 255, 0.01);
  color: #f1f5f9;
}
.r-align { text-align: right; }
.bold { font-weight: 600; }
.font-mono { font-family: 'JetBrains Mono', monospace; }
.table-unit { font-size: 0.7rem; color: #64748b; margin-left: 2px; }

.sensor-pill {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 4px 8px;
  border-radius: 6px;
}

.table-empty {
  text-align: center;
  color: #475569;
  padding: 40px 16px !important;
}

/* Pagination Footer */
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  font-size: 0.76rem;
}
.records-count {
  color: #475569;
  font-weight: 500;
}
.pagination {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pg-btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}
.pg-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.04);
  color: #f1f5f9;
}
.pg-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.pg-info {
  color: #64748b;
  font-weight: 600;
}

/* Mobile Responsiveness Improvements */
@media (max-width: 900px) {
  .controls-row {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }
  .period-selector {
    justify-content: center;
  }
  .action-buttons {
    justify-content: center;
  }
  .overlays-selector {
    justify-content: center;
  }
}

@media (max-width: 700px) {
  .logs-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .lh-right {
    flex-direction: column;
    width: 100%;
    gap: 8px;
  }
  .sensor-dropdown,
  .table-search {
    width: 100%;
  }
}

@media (max-width: 600px) {
  .chart-container,
  .logs-container {
    padding: 16px 14px;
  }
  .chart-canvas-wrap {
    height: 250px;
  }
  .table-footer {
    flex-direction: column;
    gap: 12px;
    align-items: center;
  }
  .pg-btn {
    padding: 6px 10px;
    font-size: 0.72rem;
  }
}
</style>
