<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";

const canvasRef = ref<HTMLCanvasElement>();
let animId: number;
let lastTime = 0;
const FPS = 30;
const FRAME_MS = 1000 / FPS;

const COUNT = 18;

const route = useRoute();
let visibilityMultiplier = 1.0;
const BASE_VISIBILITY = 0.55;

watch(
  () => route?.path,
  () => {
    visibilityMultiplier = 1.0;
  }
);

// ─── Color palettes ──────────────────────────────────────────────────────────
const darkPalette = [
  "235, 180, 100",  // light golden
  "212, 162, 127",  // warm tan
  "230, 140, 60",   // amber
  "220, 120, 50",   // deep orange
  "200, 90, 40",    // burnt orange
  "190, 60, 45",    // red-orange
];

const lightPalette = [
  "160, 140, 240",  // soft lavender
  "130, 110, 230",  // medium purple
  "92, 114, 243",   // accent blue-purple
  "120, 80, 220",   // violet
  "100, 60, 200",   // deep purple
  "140, 50, 180",   // magenta-purple
];

interface Shape {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  type: "circle" | "hexagon" | "diamond";
  phase: number;
  colorIdx: number;
}

const shapes: Shape[] = [];

function init() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const types: Shape["type"][] = ["circle", "hexagon", "diamond"];

  for (let i = 0; i < COUNT; i++) {
    shapes.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 20 + 8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.008,
      type: types[Math.floor(Math.random() * types.length)],
      phase: Math.random() * Math.PI * 2,
      colorIdx: Math.floor(Math.random() * 6),
    });
  }
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + rotation;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI / 2) * i + rotation;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

let time = 0;

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isDark = document.documentElement.classList.contains("dark");
  const palette = isDark ? darkPalette : lightPalette;
  const lineRgb = isDark ? "212, 162, 127" : "92, 114, 243";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  time += 0.01;

  if (visibilityMultiplier > BASE_VISIBILITY) {
    visibilityMultiplier -= 0.015; // decays over ~1.5s
    if (visibilityMultiplier < BASE_VISIBILITY) {
      visibilityMultiplier = BASE_VISIBILITY;
    }
  }

  for (let i = 0; i < COUNT; i++) {
    const s = shapes[i];
    const pulse = 0.7 + 0.3 * Math.sin(time * 2 + s.phase);
    const rgb = palette[s.colorIdx];

    if (isDark) {
      ctx.strokeStyle = `rgba(${rgb}, ${0.28 * pulse * visibilityMultiplier})`;
      ctx.fillStyle = `rgba(${rgb}, ${0.12 * pulse * visibilityMultiplier})`;
    } else {
      ctx.strokeStyle = `rgba(${rgb}, ${0.55 * pulse * visibilityMultiplier})`;
      ctx.fillStyle = `rgba(${rgb}, ${0.22 * pulse * visibilityMultiplier})`;
    }
    ctx.lineWidth = 1.2;

    if (s.type === "circle") {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (s.type === "hexagon") {
      drawHexagon(ctx, s.x, s.y, s.size * pulse, s.rotation);
      ctx.fill();
      ctx.stroke();
    } else {
      drawDiamond(ctx, s.x, s.y, s.size * pulse, s.rotation);
      ctx.fill();
      ctx.stroke();
    }

    // Draw faint connecting lines to nearby shapes
    for (let j = i + 1; j < COUNT; j++) {
      const s2 = shapes[j];
      const dx = s.x - s2.x;
      const dy = s.y - s2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 180) {
        const lineRgb = isDark ? "212, 162, 127" : "92, 114, 243";
        const alpha = (1 - dist / 200) * (isDark ? 0.15 : 0.30) * visibilityMultiplier;
        ctx.strokeStyle = `rgba(${lineRgb}, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
      }
    }

    // Update position
    s.x += s.vx;
    s.y += s.vy;
    s.rotation += s.rotationSpeed;

    if (s.x < -s.size) s.x = canvas.width + s.size;
    if (s.x > canvas.width + s.size) s.x = -s.size;
    if (s.y < -s.size) s.y = canvas.height + s.size;
    if (s.y > canvas.height + s.size) s.y = -s.size;
  }
}

function loop(ts: number) {
  if (ts - lastTime >= FRAME_MS) {
    lastTime = ts;
    draw();
  }
  animId = requestAnimationFrame(loop);
}

function onResize() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

onMounted(() => {
  init();
  animId = requestAnimationFrame(loop);
  window.addEventListener("resize", onResize);
});

onUnmounted(() => {
  cancelAnimationFrame(animId);
  window.removeEventListener("resize", onResize);
});
</script>

<template>
  <canvas ref="canvasRef" class="particle-canvas" />
</template>

<style scoped>
.particle-canvas {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  will-change: transform;
}
</style>
