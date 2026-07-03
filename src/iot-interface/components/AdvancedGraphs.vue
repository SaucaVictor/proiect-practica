<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { Chart, registerables } from "chart.js";
import { useHistoricalReadings } from "../composables/useHistoricalReadings";
import { supabase } from "@/services/supabase/client";

Chart.register(...registerables);

const period = ref<"1h" | "6h" | "24h" | "7d" | "all">("1h");

const periods = [
  { value: "1h",  label: "1 Oră" },
  { value: "6h",  label: "6 Ore" },
  { value: "24h", label: "24 Ore" },
  { value: "7d",  label: "7 Zile" },
  { value: "all", label: "Toate" },
] as const;

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

const isPaused = ref(false);

function syncLiveToFrozen() {
  (Object.keys(queries) as SensorKey[]).forEach(k => {
    frozenReadings.value[k] = [...queries[k].readings.value];
    frozenRawReadings.value[k] = [...queries[k].rawReadings.value];
    frozenStats.value[k] = { ...queries[k].stats.value };
  });
}

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
    syncLiveToFrozen();
    updateChart();
  }
}

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
          backgroundColor: "#1a1b1e",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          padding: 12,
          titleColor: "#9aa0b2",
          bodyColor: "#e8eaf0",
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
            color: "#9aa0b2",
            font: { size: 9, family: "Inter" },
            maxTicksLimit: 8,
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

  (Object.keys(SENSORS_CFG) as SensorKey[]).forEach(key => {
    const active = activeSensors.value[key];
    const cfg = SENSORS_CFG[key];
    
    if (chart!.options.scales?.[cfg.yAxis]) {
      (chart!.options.scales[cfg.yAxis] as any).display = active;
    }

    if (!active) return;

    const data = frozenReadings.value[key].map(r => r.value);
    
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
      borderWidth: 2,
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
    const periodMs: Record<string, number> = {
      "1h":  1 * 60 * 60 * 1000,
      "6h":  6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d":  7 * 24 * 60 * 60 * 1000,
    };
    const cutoff = periodMs[period.value]
      ? new Date(Date.now() - periodMs[period.value])
      : null;

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

    for (const key of activeKeys) {
      const cfg = SENSORS_CFG[key];
      let queryBuilder = supabase
        .from("iot_sensor_readings")
        .select("value, timestamp")
        .eq("sensor_name", key)
        .order("timestamp", { ascending: true });

      if (cutoff) {
        queryBuilder = queryBuilder.gte("timestamp", cutoff.toISOString());
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;

      (data || []).forEach(r => {
        const d = r.timestamp ? new Date(r.timestamp) : null;
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
  <div class="flex flex-col gap-6">
    
    <!-- Timeframe Selection & Sensor toggles -->
    <div class="flex flex-wrap items-center justify-between gap-4 bg-[var(--iot-bg-subtle)] border border-[var(--iot-border)] rounded-2xl p-4">
      <!-- Period Selector -->
      <div class="flex bg-white/5 border border-white/5 rounded-xl p-1">
        <button
          v-for="p in periods"
          :key="p.value"
          class="px-3.5 py-1.5 rounded-lg border-0 bg-transparent text-xs font-semibold text-[var(--iot-text-muted)] hover:text-[var(--iot-text)] cursor-pointer transition-all duration-200"
          :class="{ 'bg-[var(--iot-accent)]/15 text-[var(--iot-accent)]': period === p.value }"
          @click="period = p.value"
        >
          {{ p.label }}
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2">
        <button
          class="flex items-center gap-1.5 px-3.5 py-2 border border-white/5 rounded-xl text-xs font-semibold text-[var(--iot-text-muted)] hover:text-[var(--iot-text)] hover:border-white/10 bg-white/5 cursor-pointer transition-all duration-200"
          :class="{ 'border-amber-500/30 text-amber-400 bg-amber-500/5': isPaused }"
          @click="togglePause"
        >
          <span>{{ isPaused ? 'Reia Fluxul' : 'Pauză Flux' }}</span>
        </button>
        <button
          class="flex items-center gap-1.5 px-3.5 py-2 border-0 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[var(--iot-accent)] to-[#4453e7] hover:shadow-[0_4px_12px_rgba(92,114,243,0.3)] cursor-pointer transition-all duration-200 disabled:opacity-50"
          :disabled="isExporting"
          @click="exportToCSV"
        >
          <span>{{ isExporting ? 'Se exportă...' : 'Export CSV' }}</span>
        </button>
      </div>

      <!-- Sensor Overlays checkboxes -->
      <div class="flex flex-wrap gap-2">
        <label
          v-for="(cfg, key) in SENSORS_CFG"
          :key="key"
          class="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/5 bg-white/5 text-xs text-[var(--iot-text-muted)] cursor-pointer hover:border-white/10 select-none transition-all duration-200"
          :class="{ 'border-white/20 bg-white/10 text-[var(--iot-text)]': activeSensors[key] }"
        >
          <input type="checkbox" v-model="activeSensors[key]" class="hidden" />
          <span class="w-1.5 h-1.5 rounded-full transition-all duration-200" :style="{ backgroundColor: activeSensors[key] ? cfg.color : '#4b5563', boxShadow: activeSensors[key] ? `0 0 8px ${cfg.color}` : 'none' }" />
          <span class="font-semibold">{{ cfg.label }}</span>
        </label>
      </div>
    </div>

    <!-- Aggregations Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="(cfg, key) in SENSORS_CFG"
        :key="key"
        class="flex flex-col justify-between bg-[var(--iot-card-bg)] border border-[var(--iot-border)] border-l-4 rounded-2xl p-5 hover:border-[var(--iot-border-hover)] hover:-translate-y-0.5 transition-all duration-300"
        :style="{ borderLeftColor: cfg.color }"
        :class="{ 'opacity-40': !activeSensors[key] }"
      >
        <div class="flex justify-between items-center mb-3">
          <span class="text-[10px] font-bold tracking-wider uppercase text-[var(--iot-text-muted)]">{{ cfg.label }}</span>
          <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: cfg.color }" />
        </div>
        
        <div class="flex flex-col gap-2.5" v-if="!queries[key].loading.value">
          <div class="flex justify-between items-baseline">
            <span class="text-[10px] text-[var(--iot-text-muted)] opacity-60">Medie:</span>
            <span class="font-mono text-xl font-medium text-[var(--iot-text)]">{{ frozenStats[key].avg.toFixed(1) }}<span class="text-xs text-[var(--iot-text-muted)] ml-0.5">{{ cfg.unit }}</span></span>
          </div>
          <div class="flex justify-between gap-2 border-t border-white/5 pt-2 text-[10px] text-[var(--iot-text-muted)]">
            <div class="flex flex-col">
              <span class="opacity-50">Min:</span>
              <span class="font-mono font-medium text-[var(--iot-text)]">{{ frozenStats[key].min.toFixed(1) }}{{ cfg.unit }}</span>
            </div>
            <div class="flex flex-col text-right">
              <span class="opacity-50">Max:</span>
              <span class="font-mono font-medium text-[var(--iot-text)]">{{ frozenStats[key].max.toFixed(1) }}{{ cfg.unit }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 py-4 text-xs text-[var(--iot-text-muted)]" v-else>
          <div class="w-3.5 h-3.5 border-2 border-white/10 border-t-[var(--iot-accent)] rounded-full animate-spin" />
          <span>Se încarcă statistici…</span>
        </div>
      </div>
    </div>

    <!-- Large Correlation Graph -->
    <div class="bg-[var(--iot-card-bg)] border border-[var(--iot-border)] rounded-2xl p-5.5">
      <div class="mb-4">
        <h3 class="text-sm font-bold text-[var(--iot-text)]">Tendințe Telemetrie Istorică</h3>
        <p class="text-[10px] text-[var(--iot-text-muted)]">Grafic de corelație dinamică multi-ax</p>
      </div>
      <div class="h-80 relative">
        <canvas ref="canvas" />
      </div>
    </div>

    <!-- Raw Data Logs Table -->
    <div class="bg-[var(--iot-card-bg)] border border-[var(--iot-border)] rounded-2xl overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-white/5">
        <div>
          <h3 class="text-sm font-bold text-[var(--iot-text)]">Jurnal Telemetrie</h3>
          <p class="text-[10px] text-[var(--iot-text-muted)]">Înregistrări din baza de date</p>
        </div>

        <div class="flex items-center gap-2">
          <!-- Dropdown -->
          <select v-model="selectedLogSensor" class="bg-[var(--iot-bg-subtle)] border border-white/10 rounded-xl px-3 py-2 text-xs text-[var(--iot-text)] font-semibold outline-none cursor-pointer focus:border-[var(--iot-accent)]/50">
            <option v-for="(cfg, key) in SENSORS_CFG" :key="key" :value="key">
              {{ cfg.label }}
            </option>
          </select>
          <!-- Search -->
          <input
            v-model="searchQuery"
            class="bg-[var(--iot-bg-subtle)] border border-white/10 rounded-xl px-3 py-2 text-xs text-[var(--iot-text)] outline-none focus:border-[var(--iot-accent)]/50 placeholder-[var(--iot-text-muted)]/40"
            placeholder="Căutare..."
            spellcheck="false"
          />
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-white/5 text-[10px] font-bold tracking-wider uppercase text-[var(--iot-text-muted)] bg-white/5">
              <th class="px-5 py-3">Marca de Timp</th>
              <th class="px-5 py-3">Metric Senzor</th>
              <th class="px-5 py-3 text-right">Valoare Citită</th>
            </tr>
          </thead>
          <tbody class="text-xs divide-y divide-white/5">
            <tr v-for="(log, idx) in paginatedLogs" :key="idx" class="hover:bg-white/5 transition-colors duration-150 text-[var(--iot-text)]">
              <td class="px-5 py-3">{{ log.timestamp?.toDate().toLocaleString() ?? "În așteptare…" }}</td>
              <td class="px-5 py-3">
                <span
                  class="inline-block text-[10px] font-bold px-2 py-0.5 rounded"
                  :style="{ color: SENSORS_CFG[selectedLogSensor].color, backgroundColor: SENSORS_CFG[selectedLogSensor].color + '15' }"
                >
                  {{ SENSORS_CFG[selectedLogSensor].label }}
                </span>
              </td>
              <td class="px-5 py-3 text-right font-mono font-medium text-[var(--iot-accent)]">
                {{ log.value.toFixed(2) }}<span class="text-[10px] text-[var(--iot-text-muted)] ml-0.5">{{ SENSORS_CFG[selectedLogSensor].unit }}</span>
              </td>
            </tr>
            <tr v-if="filteredLogs.length === 0">
              <td colspan="3" class="px-5 py-8 text-center text-xs text-[var(--iot-text-muted)] opacity-60">Niciun jurnal de telemetrie găsit.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="flex items-center justify-between p-4 border-t border-white/5 bg-white/5 text-[10px] text-[var(--iot-text-muted)]" v-if="totalPages > 1">
        <span>{{ filteredLogs.length }} înregistrări</span>
        <div class="flex items-center gap-3">
          <button
            class="p-1 rounded bg-transparent border border-white/5 hover:border-white/10 text-[var(--iot-text)] disabled:opacity-40 cursor-pointer"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            ◀
          </button>
          <span>Pagina {{ currentPage }} din {{ totalPages }}</span>
          <button
            class="p-1 rounded bg-transparent border border-white/5 hover:border-white/10 text-[var(--iot-text)] disabled:opacity-40 cursor-pointer"
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
