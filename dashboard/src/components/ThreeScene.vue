<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import * as THREE from "three";

const canvas = ref<HTMLCanvasElement>();

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let animId: number;
let points: THREE.Points;
let lines: THREE.LineSegments;

const COUNT = 120;
const positions = new Float32Array(COUNT * 3);
const velocities: { x: number; y: number; z: number }[] = [];

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 2000);
  camera.position.z = 500;

  renderer = new THREE.WebGLRenderer({ canvas: canvas.value!, alpha: true, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(devicePixelRatio);

  // Particles
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * innerWidth;
    positions[i * 3 + 1] = (Math.random() - 0.5) * innerHeight;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    velocities.push({
      x: (Math.random() - 0.5) * 0.4,
      y: (Math.random() - 0.5) * 0.4,
      z: (Math.random() - 0.5) * 0.1,
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({ color: 0x818cf8, size: 2.5, sizeAttenuation: true, transparent: true, opacity: 0.75 });
  points = new THREE.Points(geo, mat);
  scene.add(points);

  // Lines buffer (pre-allocated)
  const linePos = new Float32Array(COUNT * COUNT * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.12 });
  lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);
}

function animate() {
  animId = requestAnimationFrame(animate);

  const hw = innerWidth / 2;
  const hh = innerHeight / 2;

  // Move particles + bounce off bounds
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3]     += velocities[i].x;
    positions[i * 3 + 1] += velocities[i].y;
    positions[i * 3 + 2] += velocities[i].z;

    if (Math.abs(positions[i * 3])     > hw)  velocities[i].x *= -1;
    if (Math.abs(positions[i * 3 + 1]) > hh)  velocities[i].y *= -1;
    if (Math.abs(positions[i * 3 + 2]) > 100) velocities[i].z *= -1;
  }
  (points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

  // Rebuild lines
  const lineArr = (lines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
  let li = 0;
  const DIST = 160;
  for (let a = 0; a < COUNT; a++) {
    for (let b = a + 1; b < COUNT; b++) {
      const dx = positions[a * 3]     - positions[b * 3];
      const dy = positions[a * 3 + 1] - positions[b * 3 + 1];
      const dz = positions[a * 3 + 2] - positions[b * 3 + 2];
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < DIST) {
        lineArr[li++] = positions[a * 3]; lineArr[li++] = positions[a * 3 + 1]; lineArr[li++] = positions[a * 3 + 2];
        lineArr[li++] = positions[b * 3]; lineArr[li++] = positions[b * 3 + 1]; lineArr[li++] = positions[b * 3 + 2];
      }
    }
  }
  lines.geometry.setDrawRange(0, li / 3);
  (lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

onMounted(() => { init(); animate(); window.addEventListener("resize", onResize); });
onUnmounted(() => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize); renderer.dispose(); });
</script>

<template>
  <canvas ref="canvas" class="three-canvas" />
</template>

<style scoped>
.three-canvas {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
</style>
