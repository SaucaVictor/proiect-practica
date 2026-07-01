<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useAudioCall } from '@/composables/useAudioCall'

const { status, error, stream, connect, disconnect } = useAudioCall()

const audioRef = ref<HTMLAudioElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isMuted = ref(false)
const volume = ref(80)

let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let sourceNode: MediaStreamAudioSourceNode | null = null
let animationFrameId: number | null = null

// Bind stream to audio element
watch(stream, (newStream) => {
  if (audioRef.value && newStream) {
    audioRef.value.srcObject = newStream
    audioRef.value.volume = isMuted.value ? 0 : volume.value / 100
    audioRef.value.play().catch((e) => console.error('Errore redare audio:', e))
    setupVisualizer(newStream)
  } else if (!newStream) {
    cleanupVisualizer()
  }
})

// Manage Mute Toggle
function toggleMute() {
  isMuted.value = !isMuted.value
  if (audioRef.value) {
    audioRef.value.volume = isMuted.value ? 0 : volume.value / 100
  }
}

// Manage Volume change
function handleVolumeChange(e: Event) {
  const target = e.target as HTMLInputElement
  volume.value = Number(target.value)
  if (audioRef.value && !isMuted.value) {
    audioRef.value.volume = volume.value / 100
  }
}

// Web Audio API Visualizer Setup
function setupVisualizer(mediaStream: MediaStream) {
  cleanupVisualizer()

  try {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    
    sourceNode = audioCtx.createMediaStreamSource(mediaStream)
    sourceNode.connect(analyser)
    
    // We don't connect to destination because the audio element is already playing it
    // (connecting to destination will duplicate the sound and cause echoes)
    drawVisualizer()
  } catch (e) {
    console.error('Failed setting up AudioContext visualizer:', e)
  }
}

function cleanupVisualizer() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  if (sourceNode) {
    sourceNode.disconnect()
    sourceNode = null
  }
  if (analyser) {
    analyser = null
  }
  if (audioCtx) {
    audioCtx.close()
    audioCtx = null
  }
}

// Visualizer Canvas loop
function drawVisualizer() {
  if (!canvasRef.value) return
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const bufferLength = analyser ? analyser.frequencyBinCount : 128
  const dataArray = new Uint8Array(bufferLength)

  const draw = () => {
    animationFrameId = requestAnimationFrame(draw)
    
    const width = canvas.width
    const height = canvas.height
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    if (analyser && status.value === 'connected') {
      analyser.getByteTimeDomainData(dataArray)
      
      ctx.lineWidth = 3
      // Gradient color for a premium visualizer
      const gradient = ctx.createLinearGradient(0, 0, width, 0)
      gradient.addColorStop(0, '#818cf8') // Indigo
      gradient.addColorStop(0.5, '#ec4899') // Pink
      gradient.addColorStop(1, '#3b82f6') // Blue
      ctx.strokeStyle = gradient
      
      ctx.beginPath()
      const sliceWidth = width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * height) / 2

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }

        x += sliceWidth
      }

      ctx.lineTo(width, height / 2)
      ctx.stroke()
    } else {
      // Draw standard idle/glowing wave
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.beginPath()
      
      const time = Date.now() * 0.004
      const amplitude = status.value === 'connecting' ? 15 : 4
      const frequency = status.value === 'connecting' ? 0.05 : 0.02

      for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.sin(x * frequency + time) * amplitude
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }
  }

  draw()
}

// Start idle visualizer drawing on mount
onMounted(() => {
  if (canvasRef.value) {
    // Set proper resolution
    canvasRef.value.width = canvasRef.value.offsetWidth
    canvasRef.value.height = canvasRef.value.offsetHeight
    drawVisualizer()
  }
})

onUnmounted(() => {
  cleanupVisualizer()
})
</script>

<template>
  <div class="audio-call-container">

    <!-- Animated background glows -->
    <div class="bg-glow bg-glow--left"></div>
    <div class="bg-glow bg-glow--right"></div>

    <!-- Subtle grid overlay -->
    <div class="grid-overlay"></div>

    <!-- Hidden audio element -->
    <audio ref="audioRef" autoplay></audio>

    <div class="content-wrapper">

      <!-- Top Title section -->
      <header class="page-header">
        <span class="status-badge">
          <span class="status-badge__dot" :class="{ 'status-badge__dot--active': status === 'connected' }"></span>
          Canal Audio WebRTC
        </span>
        <h1 class="page-title">
          Curs Live ClassMonitor
        </h1>
        <p class="page-subtitle">
          Conectează-te la fluxul audio în timp real transmis din sala de curs prin brokerul local.
        </p>
      </header>

      <!-- Center Audio Visualizer Panel -->
      <main class="visualizer-section">
        <div class="visualizer-card">

          <!-- Decorative ambient glow inside card -->
          <div class="card-glow" :class="{
            'card-glow--connected': status === 'connected',
            'card-glow--failed':    status === 'failed',
          }"></div>

          <!-- Canvas Visualizer -->
          <canvas ref="canvasRef" class="visualizer-canvas"></canvas>

          <!-- Status Indicator -->
          <div class="status-indicator">
            <div class="status-circle" :class="{
              'status-circle--disconnected': status === 'disconnected',
              'status-circle--connecting':   status === 'connecting',
              'status-circle--connected':    status === 'connected',
              'status-circle--failed':       status === 'failed',
            }">
              <span v-if="status === 'connected'"  class="ripple ripple--green"></span>
              <span v-if="status === 'connecting'" class="ripple ripple--indigo"></span>

              <span class="status-icon">
                <span v-if="status === 'connected'">🎙️</span>
                <span v-else-if="status === 'connecting'">⏳</span>
                <span v-else-if="status === 'failed'">⚠️</span>
                <span v-else>🔇</span>
              </span>
            </div>

            <span class="status-label" :class="{
              'status-label--disconnected': status === 'disconnected',
              'status-label--connecting':   status === 'connecting',
              'status-label--connected':    status === 'connected',
              'status-label--failed':       status === 'failed',
            }">
              <span v-if="status === 'connected'">Conectat la Curs</span>
              <span v-else-if="status === 'connecting'">Se conectează...</span>
              <span v-else-if="status === 'failed'">Eroare Conexiune</span>
              <span v-else>Deconectat</span>
            </span>
          </div>
        </div>

        <!-- Connection Details -->
        <div v-if="status === 'connected'" class="connection-details">
          <span>CODEC: Opus Audio</span>
          <span>LATENCY: ~150ms</span>
          <span>CHANNELS: 1 (Mono)</span>
        </div>

        <!-- Error Alert -->
        <div v-if="error" class="error-alert">
          {{ error }}
        </div>
      </main>

      <!-- Bottom controls -->
      <footer class="controls-footer">

        <!-- Volume slider -->
        <div class="volume-panel">
          <button @click="toggleMute" class="mute-btn">
            <svg v-if="isMuted || volume === 0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"></line>
              <path d="M9 9v6a3 3 0 0 0 5.12 2.12M18.88 18.88A9 9 0 0 0 19 9"></path>
              <path d="M9 5a9 9 0 0 1 5.3 1.61"></path>
              <path d="M2.3 8a9 9 0 0 0 .18 10.43"></path>
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
          </button>

          <input type="range" min="0" max="100" :value="volume" @input="handleVolumeChange" class="volume-slider" />

          <span class="volume-value">{{ volume }}%</span>
        </div>

        <!-- Action button -->
        <div class="action-row">
          <button v-if="status === 'disconnected' || status === 'failed'"
                  @click="connect"
                  class="btn btn--connect">
            Conectare la Curs
          </button>

          <button v-else-if="status === 'connecting'"
                  class="btn btn--loading" disabled>
            <span class="spinner"></span>
            Se conectează...
          </button>

          <button v-else
                  @click="disconnect"
                  class="btn btn--disconnect">
            Deconectare
          </button>
        </div>

      </footer>
    </div>
  </div>
</template>

<style scoped>
/* ── Container ───────────────────────────────────────────────────────────── */
.audio-call-container {
  font-family: 'Inter', 'Outfit', sans-serif;
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #0e0f11; /* surface-0 */
  color: #e8eaf0;            /* surface-950 */
  overflow: hidden;
  z-index: 10;
  user-select: none;
}

/* ── Animated background glows ───────────────────────────────────────────── */
.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  pointer-events: none;
  animation: glow-drift 8s ease-in-out infinite alternate;
  z-index: 0;
}
.bg-glow--left {
  width: 420px; height: 420px;
  top: -80px; left: -100px;
  background: radial-gradient(circle, rgba(92,114,243,0.18) 0%, transparent 70%);
  animation-delay: 0s;
}
.bg-glow--right {
  width: 380px; height: 380px;
  bottom: -60px; right: -80px;
  background: radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%);
  animation-delay: -4s;
}
@keyframes glow-drift {
  0%   { transform: translate(0, 0) scale(1); }
  100% { transform: translate(30px, 20px) scale(1.08); }
}

/* ── Grid overlay ────────────────────────────────────────────────────────── */
.grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 3rem 3rem;
  mask-image: radial-gradient(ellipse 65% 55% at 50% 50%, #000 60%, transparent 100%);
  z-index: 0;
  pointer-events: none;
}

/* ── Content ─────────────────────────────────────────────────────────────── */
.content-wrapper {
  position: relative;
  z-index: 10;
  flex: 1;
  max-width: 56rem;
  margin: 0 auto;
  width: 100%;
  padding: 3rem 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2rem;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.page-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: rgba(92, 114, 243, 0.1);
  color: #a4b9fc;
  border: 1px solid rgba(92, 114, 243, 0.25);
}
.status-badge__dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #737c8e;
  transition: background 0.3s;
}
.status-badge__dot--active {
  background: #4ade80;
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.6);
  animation: pulse-dot 1.5s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
.page-title {
  font-size: 1.9rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #e8eaf0 0%, #a4b9fc 50%, #c4c9d4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}
.page-subtitle {
  font-size: 0.85rem;
  color: #737c8e;
  max-width: 30rem;
  margin: 0;
  line-height: 1.6;
}

/* ── Visualizer ──────────────────────────────────────────────────────────── */
.visualizer-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.visualizer-card {
  width: 100%;
  max-width: 42rem;
  aspect-ratio: 21/9;
  border-radius: 1.5rem;
  background: rgba(26, 27, 30, 0.6);
  border: 1px solid rgba(255,255,255,0.06);
  backdrop-filter: blur(20px);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  box-shadow: 0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
}
.card-glow {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 12rem; height: 12rem;
  border-radius: 50%;
  background: rgba(92, 114, 243, 0.12);
  filter: blur(60px);
  pointer-events: none;
  transition: all 0.5s ease;
}
.card-glow--connected { background: rgba(16, 185, 129, 0.12); width: 16rem; height: 16rem; }
.card-glow--failed    { background: rgba(239, 68, 68, 0.12); }

.visualizer-canvas {
  width: 100%;
  height: 6rem;
  position: relative;
  z-index: 10;
  pointer-events: none;
}

/* ── Status indicator ────────────────────────────────────────────────────── */
.status-indicator {
  position: absolute;
  bottom: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 10;
}
.status-circle {
  width: 4rem; height: 4rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s ease;
}
.status-circle--disconnected { background: rgba(42,45,51,0.8); border: 1px solid rgba(255,255,255,0.08); }
.status-circle--connecting   { background: rgba(92,114,243,0.15); border: 1px solid rgba(92,114,243,0.3); animation: subtle-pulse 1.5s ease-in-out infinite; }
.status-circle--connected    { background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4); box-shadow: 0 0 20px rgba(16,185,129,0.2); }
.status-circle--failed       { background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4); }
@keyframes subtle-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(92,114,243,0.3); }
  50%       { box-shadow: 0 0 0 8px rgba(92,114,243,0); }
}
.ripple {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  animation: ping 1.2s cubic-bezier(0,0,0.2,1) infinite;
  opacity: 0.5;
}
.ripple--green  { border: 1px solid rgba(74,222,128,0.5); }
.ripple--indigo { border: 1px solid rgba(99,102,241,0.5); }
@keyframes ping {
  75%, 100% { transform: scale(1.6); opacity: 0; }
}
.status-icon { font-size: 1.4rem; position: relative; z-index: 1; }
.status-label {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: color 0.3s;
  margin-top: 4px;
}
.status-label--disconnected { color: #737c8e; }
.status-label--connecting   { color: #a4b9fc; }
.status-label--connected    { color: #4ade80; }
.status-label--failed       { color: #f87171; }

/* ── Connection details ──────────────────────────────────────────────────── */
.connection-details {
  display: flex;
  gap: 1.5rem;
  font-size: 0.68rem;
  font-family: 'JetBrains Mono', monospace;
  color: #464b55;
  letter-spacing: 0.04em;
}

/* ── Error ───────────────────────────────────────────────────────────────── */
.error-alert {
  max-width: 28rem;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  color: #f87171;
  text-align: center;
}

/* ── Controls footer ─────────────────────────────────────────────────────── */
.controls-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}
.volume-panel {
  width: 100%;
  max-width: 22rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-radius: 1rem;
  background: rgba(26,27,30,0.5);
  border: 1px solid rgba(255,255,255,0.05);
  backdrop-filter: blur(12px);
}
.mute-btn {
  background: transparent;
  border: 0;
  cursor: pointer;
  color: #737c8e;
  padding: 0.4rem;
  border-radius: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.mute-btn:hover { background: rgba(255,255,255,0.05); color: #e8eaf0; }
.volume-slider {
  flex: 1;
  accent-color: #5c72f3;
  appearance: none;
  height: 4px;
  border-radius: 9999px;
  background: #2a2d33;
  cursor: pointer;
  outline: none;
}
.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: #5c72f3;
  box-shadow: 0 0 6px rgba(92,114,243,0.5);
  cursor: pointer;
}
.volume-value {
  font-size: 0.7rem;
  font-family: 'JetBrains Mono', monospace;
  color: #737c8e;
  width: 2.5rem;
  text-align: right;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.action-row { display: flex; align-items: center; gap: 1rem; }
.btn {
  padding: 0.75rem 2rem;
  border-radius: 0.875rem;
  font-weight: 700;
  font-size: 0.875rem;
  letter-spacing: 0.02em;
  border: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}
.btn--connect {
  background: linear-gradient(135deg, #5c72f3, #7c97f8);
  color: #fff;
  box-shadow: 0 8px 24px rgba(92,114,243,0.3);
}
.btn--connect:hover {
  background: linear-gradient(135deg, #4453e7, #5c72f3);
  transform: translateY(-1px);
  box-shadow: 0 12px 32px rgba(92,114,243,0.4);
}
.btn--loading {
  background: #1a1b1e;
  color: #737c8e;
  border: 1px solid rgba(255,255,255,0.06);
  cursor: not-allowed;
}
.btn--disconnect {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
  box-shadow: 0 8px 24px rgba(239,68,68,0.25);
}
.btn--disconnect:hover {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  transform: translateY(-1px);
  box-shadow: 0 12px 32px rgba(239,68,68,0.35);
}
.spinner {
  width: 1rem; height: 1rem;
  border: 2px solid #363a42;
  border-top-color: #7c97f8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
