<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { Chart, registerables } from "chart.js";
import { useReadings } from "../composables/useReadings";

Chart.register(...registerables);

const props = defineProps<{
  sensorName: string;
  label: string;
  color: string;
  unit?: string;
}>();

const canvas = ref<HTMLCanvasElement>();
let chart: Chart | null = null;
const { readings } = useReadings(props.sensorName, 40);

function buildChart() {
  const ctx = canvas.value!.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0, props.color + "55");
  grad.addColorStop(1, props.color + "00");

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: props.label,
        data: [],
        borderColor: props.color,
        backgroundColor: grad,
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: props.color,
        pointBorderColor: "transparent",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a1e2a",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          titleColor: "#94a3b8",
          bodyColor: "#e2e8f0",
          padding: 10,
          callbacks: {
            label: (c) => ` ${(c.parsed.y ?? 0).toFixed(2)}${props.unit ?? ""}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: {
            color: "#64748b",
            font: { size: 10, family: "Inter" },
            maxTicksLimit: 8,
            maxRotation: 0,
          },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: {
            color: "#64748b",
            font: { size: 10, family: "Inter" },
            callback: (v) => `${v}${props.unit ?? ""}`,
          },
        },
      },
    },
  });
}

watch(readings, (data) => {
  if (!chart) return;
  chart.data.labels = data.map(
    (r) => r.timestamp?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) ?? ""
  );
  chart.data.datasets[0].data = data.map((r) => r.value);
  chart.update("none");
}, { deep: true });

onMounted(buildChart);
onUnmounted(() => chart?.destroy());
</script>

<template>
  <div class="chart-card">
    <div class="chart-header">
      <span class="chart-title">{{ label }}</span>
      <span class="chart-count">{{ readings.length }} pts</span>
    </div>
    <div class="chart-wrap">
      <canvas ref="canvas" />
    </div>
    <div v-if="readings.length === 0" class="chart-empty">
      Waiting for data…
    </div>
  </div>
</template>

<style scoped>
.chart-card {
  background: rgba(19, 22, 31, 0.75);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 20px 20px 16px;
  backdrop-filter: blur(16px);
  position: relative;
}
.chart-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px;
}
.chart-title { font-size: 0.78rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; }
.chart-count  { font-size: 0.68rem; color: #475569; }
.chart-wrap   { height: 160px; position: relative; }
.chart-empty  {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #475569; font-size: 0.82rem;
}
</style>
