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
  if (!canvas.value) return;
  const ctx = canvas.value.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0, props.color + "44");
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
        pointRadius: 2,
        pointHoverRadius: 4,
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
          backgroundColor: "#1a1b1e",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          titleColor: "#9aa0b2",
          bodyColor: "#e8eaf0",
          padding: 10,
          callbacks: {
            label: (c) => ` ${(c.parsed.y ?? 0).toFixed(2)}${props.unit ?? ""}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.03)" },
          ticks: {
            color: "#9aa0b2",
            font: { size: 9, family: "Inter" },
            maxTicksLimit: 6,
            maxRotation: 0,
          },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.03)" },
          ticks: {
            color: "#9aa0b2",
            font: { size: 9, family: "Inter" },
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
  <div class="relative bg-[var(--iot-card-bg)] border border-[var(--iot-border)] rounded-2xl p-5 ">
    <div class="flex justify-between items-center mb-3">
      <span class="text-xs font-bold tracking-wider uppercase text-[var(--iot-text-muted)]">{{ label }}</span>
      <span class="text-[10px] text-[var(--iot-text-muted)] opacity-70">{{ readings.length }} pts</span>
    </div>
    <div class="h-40 relative">
      <canvas ref="canvas" />
    </div>
    <div v-if="readings.length === 0" class="absolute inset-0 flex items-center justify-center text-xs text-[var(--iot-text-muted)] bg-[var(--iot-card-bg)]/80 rounded-2xl">
      Waiting for data…
    </div>
  </div>
</template>
