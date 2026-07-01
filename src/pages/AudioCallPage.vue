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
  <div class="audio-call-container flex-1 flex flex-col bg-surface-950 text-white relative z-10 select-none">
    
    <!-- Background grid decoration -->
    <div class="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 z-0"></div>

    <!-- Hidden audio element -->
    <audio ref="audioRef" autoplay></audio>

    <div class="relative z-10 flex-1 max-w-4xl mx-auto w-full px-6 py-12 flex flex-col justify-between">
      
      <!-- Top Title section -->
      <header class="text-center space-y-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          Canal Audio WebRTC
        </span>
        <h1 class="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-100 via-indigo-200 to-slate-200">
          Curs Live ClassMonitor
        </h1>
        <p class="text-sm text-slate-400 max-w-md mx-auto">
          Conectează-te la fluxul audio în timp real transmis din sala de curs prin brokerul local.
        </p>
      </header>

      <!-- Center Audio Visualizer Panel -->
      <main class="my-8 flex flex-col items-center justify-center">
        <div class="w-full aspect-[21/9] max-w-2xl rounded-3xl bg-slate-900/40 border border-white/5 backdrop-blur-xl relative overflow-hidden flex flex-col items-center justify-center p-6 shadow-2xl">
          
          <!-- Decorative ambient glows -->
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-indigo-500/10 blur-[60px] pointer-events-none transition-all duration-500"
               :class="{ 'bg-emerald-500/10 blur-[80px] w-64 h-64': status === 'connected', 'bg-red-500/10 blur-[80px]': status === 'failed' }"></div>

          <!-- Canvas Visualizer -->
          <canvas ref="canvasRef" class="w-full h-24 relative z-10 pointer-events-none"></canvas>

          <!-- Voice Speaker Animation Indicator -->
          <div class="absolute bottom-6 flex flex-col items-center gap-1.5 z-10">
            <!-- Glowing status circles -->
            <div class="w-16 h-16 rounded-full flex items-center justify-center relative transition-all duration-300"
                 :class="{
                   'bg-slate-800 border border-white/10 text-slate-400': status === 'disconnected',
                   'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 animate-pulse': status === 'connecting',
                   'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]': status === 'connected',
                   'bg-red-500/20 border border-red-500/40 text-red-400': status === 'failed'
                 }">
              
              <!-- Wave ripples when connected -->
              <span v-if="status === 'connected'" class="absolute inset-0 rounded-full border border-emerald-400/40 animate-ping opacity-60"></span>
              <span v-if="status === 'connecting'" class="absolute inset-0 rounded-full border border-indigo-400/40 animate-ping opacity-60"></span>

              <span class="text-2xl font-bold">
                <span v-if="status === 'connected'">🎙️</span>
                <span v-else-if="status === 'connecting'">⏳</span>
                <span v-else-if="status === 'failed'">⚠️</span>
                <span v-else>🔇</span>
              </span>
            </div>
            
            <span class="text-xs font-semibold tracking-wider uppercase mt-2 transition-all duration-300"
                  :class="{
                    'text-slate-400': status === 'disconnected',
                    'text-indigo-400': status === 'connecting',
                    'text-emerald-400': status === 'connected',
                    'text-red-400': status === 'failed'
                  }">
              <span v-if="status === 'connected'">Conectat la Curs</span>
              <span v-else-if="status === 'connecting'">Se conectează...</span>
              <span v-else-if="status === 'failed'">Eroare Conexiune</span>
              <span v-else>Deconectat</span>
            </span>
          </div>

        </div>

        <!-- Connection Details (Show when connected) -->
        <div v-if="status === 'connected'" class="mt-4 flex gap-6 text-[11px] font-mono text-slate-500">
          <span>CODEC: Opus Audio</span>
          <span>LATENCY: ~150ms</span>
          <span>CHANNELS: 1 (Mono)</span>
        </div>
        
        <!-- Error Alert -->
        <div v-if="error" class="mt-4 max-w-md bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 text-center relative z-10">
          {{ error }}
        </div>
      </main>

      <!-- Bottom Glass controls panel -->
      <footer class="flex flex-col items-center gap-6">
        
        <!-- Volume / Mute container -->
        <div class="w-full max-w-sm flex items-center justify-between gap-4 px-6 py-3 rounded-2xl bg-slate-900/30 border border-white/5 backdrop-blur-md">
          <button @click="toggleMute" 
                  class="p-2 rounded-xl bg-transparent hover:bg-white/5 text-slate-400 hover:text-white border-0 cursor-pointer transition-colors duration-150 flex items-center justify-center">
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
          
          <input type="range" 
                 min="0" 
                 max="100" 
                 :value="volume" 
                 @input="handleVolumeChange" 
                 class="flex-1 accent-indigo-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer" />
          
          <span class="text-xs font-mono text-slate-400 w-8 text-right">{{ volume }}%</span>
        </div>

        <!-- Connection Action Button -->
        <div class="flex items-center gap-4">
          <button v-if="status === 'disconnected' || status === 'failed'"
                  @click="connect"
                  class="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-indigo-500/25 transition-all duration-200 border-0 cursor-pointer flex items-center gap-2">
            <span>Conectare la Curs</span>
          </button>
          
          <button v-else-if="status === 'connecting'"
                  class="px-8 py-3.5 rounded-2xl bg-slate-800 text-slate-400 font-bold text-sm border border-white/5 cursor-not-allowed flex items-center gap-2">
            <span class="w-4 h-4 border-2 border-slate-500 border-t-indigo-400 rounded-full animate-spin"></span>
            <span>Se conectează...</span>
          </button>

          <button v-else
                  @click="disconnect"
                  class="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-red-500/20 transition-all duration-200 border-0 cursor-pointer">
            Deconectare
          </button>
        </div>

      </footer>

    </div>
  </div>
</template>

<style scoped>
.audio-call-container {
  font-family: 'Outfit', 'Inter', sans-serif;
}
input[type="range"]::-webkit-slider-runnable-track {
  background: transparent;
}
</style>
