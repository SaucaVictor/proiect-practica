<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const canvasRef = ref<HTMLCanvasElement>();
let animId: number;
let lastTime = 0;
const FPS = 30;
const FRAME_MS = 1000 / FPS;

const COUNT = 35;   // reduced from 60 — cuts O(n²) work by ~66%
const DIST  = 90;   // reduced from 120
const particles: Array<{
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}> = [];

function init() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 1.5 + 1,
    });
  }
}

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw lines
  ctx.strokeStyle = "rgba(212, 162, 127, 0.05)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < COUNT; i++) {
    const p1 = particles[i];
    for (let j = i + 1; j < COUNT; j++) {
      const p2 = particles[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < DIST) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  // Draw dots
  ctx.fillStyle = "rgba(212, 162, 127, 0.4)";
  for (let i = 0; i < COUNT; i++) {
    const p = particles[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
  }

  animId = requestAnimationFrame(loop);
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
  will-change: transform;  /* own GPU compositing layer */
}
</style>
