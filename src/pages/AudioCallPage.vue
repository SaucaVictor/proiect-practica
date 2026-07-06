<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAudioCall } from '@/composables/useAudioCall'
import { useLiveTranscript } from '@/composables/useLiveTranscript'

// Chat and ASR Stores
import { useChatStore } from '@/stores/chat.store'
import { useConversationStore } from '@/stores/conversation.store'
import { useProviderStore } from '@/stores/provider.store'
import { useReferencesStore } from '@/stores/references.store'
import { useThemeStore } from '@/stores/theme.store'
import { useChat } from '@/composables/useChat'
import { subscribeToMessages, unsubscribe } from '@/services/supabase/realtime'
import type { RealtimeChannel } from '@supabase/supabase-js'

const themeStore = useThemeStore()

// Sub-components
import ChatMessages from '@/components/chat/ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ModelSelector from '@/components/model/ModelSelector.vue'
import ResourcesPanel from '@/components/chat/ResourcesPanel.vue'

const { status, error, stream, connect, disconnect } = useAudioCall()

// ── Live Transcript ──────────────────────────────────────────────────────────
const isTranscriptActive = ref(true)
const { segments, isListening, loadError } = useLiveTranscript(isTranscriptActive)

const transcriptPanelRef = ref<HTMLElement | null>(null)
const autoScrollEnabled = ref(true)

// Auto-scroll to the bottom when new segments arrive (if enabled)
watch(
  () => segments.value.length,
  async () => {
    if (!autoScrollEnabled.value) return
    await nextTick()
    if (transcriptPanelRef.value) {
      transcriptPanelRef.value.scrollTop = transcriptPanelRef.value.scrollHeight
    }
  }
)

const selectedSegmentIds = ref<Set<string>>(new Set())

function toggleSegmentSelection(id: string) {
  const newSet = new Set(selectedSegmentIds.value)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  selectedSegmentIds.value = newSet
}

function clearSegmentSelection() {
  selectedSegmentIds.value = new Set()
}

function referenceSelectedSegments() {
  if (selectedSegmentIds.value.size === 0) return
  
  // 1. Get chronological order of selected segments
  const selected = segments.value.filter(s => selectedSegmentIds.value.has(s.id))
  if (selected.length === 0) return
  
  // 2. Format selected segments
  const selectedText = selected.map(s => `[${formatTime(s.segment_start)}] ${s.text}`).join('\n')
  
  // 3. Format full chronological context of all segments so far
  const fullContextText = segments.value.map(s => `[${formatTime(s.segment_start)}] ${s.text}`).join('\n')
  
  // 4. Construct rich XML/Markdown extractedText block
  const extractedText = `
<lecture_transcript_context>
Here is the complete chronological transcript of the ongoing live lecture so far:
${fullContextText}
</lecture_transcript_context>

<user_highlighted_segments>
IMPORTANT: The user has selected the following specific parts of the transcript to ask you about. Focus your answer on this referenced context:
${selectedText}
</user_highlighted_segments>
`.trim()
  
  // 5. Add to references store
  refStore.addReference({
    filename: 'live-transcripts.txt',
    refType: 'live-transcript',
    label: `Transcriere Live (${selected.length} selectate)`,
    selectedText: selected.map(s => s.text).join(' '),
    extractedText: extractedText
  })
  
  // 6. Clear local selection
  clearSegmentSelection()
  
  // 7. Make sure chat is open
  if (!chatOpen.value) {
    toggleChat()
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('ro-RO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return ''
  }
}

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
    
    ctx.clearRect(0, 0, width, height)

    if (analyser && status.value === 'connected') {
      analyser.getByteTimeDomainData(dataArray)
      
      ctx.lineWidth = 3
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
      ctx.lineWidth = 1.5
      ctx.strokeStyle = themeStore.isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'
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

// ─── Embedded Chat Logic ──────────────────────────────────────────────────────
const chatStore = useChatStore()
const conversationStore = useConversationStore()
const providerStore = useProviderStore()
const refStore = useReferencesStore()
const { sendMessage, regenerate, abort } = useChat()

const chatOpen = ref(false)
const embeddedActiveId = ref<string | undefined>(undefined)
const showConvDropdown = ref(false)
const isDraggingHorizontal = ref(false)
const isDraggingVertical = ref(false)

const leftColumnWidth = ref(35) // percent when chat is open
const topPanelHeight = ref(15) // percent of left column height

const contentWrapperRef = ref<HTMLElement | null>(null)
const leftColumnRef = ref<HTMLElement | null>(null)

let realtimeChannel: RealtimeChannel | null = null

const recentConversations = computed(() => {
  return [...conversationStore.conversations].sort((a, b) => {
    const da = new Date(a.updatedAt || a.createdAt).getTime()
    const db = new Date(b.updatedAt || b.createdAt).getTime()
    return db - da
  })
})

const activeConversation = computed(() => {
  return conversationStore.conversations.find(c => c.id === embeddedActiveId.value)
})

async function loadEmbeddedConversation(id: string) {
  if (realtimeChannel) {
    unsubscribe(realtimeChannel)
    realtimeChannel = null
  }
  embeddedActiveId.value = id
  await chatStore.loadConversation(id)
  realtimeChannel = subscribeToMessages(id, {
    onUpdate: (msg) => {
      if (msg.id) chatStore.updateMessage(msg.id, msg)
    },
  })
}

function startNewEmbeddedChat() {
  if (realtimeChannel) {
    unsubscribe(realtimeChannel)
    realtimeChannel = null
  }
  embeddedActiveId.value = undefined
  chatStore.clearConversation()
  showConvDropdown.value = false
}

async function selectEmbeddedConversation(id: string) {
  showConvDropdown.value = false
  await loadEmbeddedConversation(id)
}

async function handleSend(content: string, attachments?: any[], metadata?: Record<string, any>) {
  let id = embeddedActiveId.value
  if (!id) {
    const conv = await conversationStore.create({
      model: providerStore.activeModelId,
      provider: providerStore.activeProvider,
    })
    id = conv.id
    embeddedActiveId.value = id
    await loadEmbeddedConversation(id)
  }
  await sendMessage(content, id, attachments, metadata)
}

async function handleRegenerate() {
  const id = embeddedActiveId.value
  if (id) await regenerate(id)
}

function toggleChat() {
  chatOpen.value = !chatOpen.value
  if (!chatOpen.value) {
    if (realtimeChannel) {
      unsubscribe(realtimeChannel)
      realtimeChannel = null
    }
    embeddedActiveId.value = undefined
    chatStore.clearConversation()
  } else {
    if (recentConversations.value.length > 0) {
      void loadEmbeddedConversation(recentConversations.value[0].id)
    }
  }
}

// References panel inside embedded chat
const resourcePanelOpen = ref(false)
const chatPanelWidth = ref(65) // percent of the embedded chat column width
const isDraggingChatSplit = ref(false)
const chatSplitRef = ref<HTMLElement | null>(null)

function toggleResourcePanel() {
  resourcePanelOpen.value = !resourcePanelOpen.value
}

function startChatDrag(e: MouseEvent) {
  isDraggingChatSplit.value = true
  document.addEventListener('mousemove', onChatDrag)
  document.addEventListener('mouseup', stopChatDrag)
  e.preventDefault()
}

function onChatDrag(e: MouseEvent) {
  if (!isDraggingChatSplit.value || !chatSplitRef.value) return
  const rect = chatSplitRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const pct = (x / rect.width) * 100
  chatPanelWidth.value = Math.min(80, Math.max(30, pct))
}

function stopChatDrag() {
  isDraggingChatSplit.value = false
  document.removeEventListener('mousemove', onChatDrag)
  document.removeEventListener('mouseup', stopChatDrag)
}

async function handleSendMessage(content: string, metadata?: Record<string, any>) {
  await handleSend(content, [], metadata)
}

// Synced Chat Models selection
const conv = computed(() => {
  return embeddedActiveId.value ? conversationStore.getById(embeddedActiveId.value) : null
})

watch(conv, (newConv) => {
  if (newConv) {
    if (newConv.provider && newConv.provider !== providerStore.activeProvider) {
      providerStore.setProvider(newConv.provider as any)
    }
    if (newConv.model && newConv.model !== providerStore.activeModelId) {
      providerStore.setModel(newConv.model)
    }
  } else {
    if (!embeddedActiveId.value) {
      providerStore.initialize()
    }
  }
}, { immediate: true })

watch(
  [() => providerStore.activeModelId, () => providerStore.activeProvider],
  async ([newModel, newProvider]) => {
    const id = embeddedActiveId.value
    if (id && conv.value) {
      const modelChanged = conv.value.model !== newModel
      const providerChanged = conv.value.provider !== newProvider
      if (modelChanged || providerChanged) {
        try {
          await conversationStore.update(id, {
            model: newModel,
            provider: newProvider as any,
          })
        } catch (err) {
          console.error('Failed to update conversation settings', err)
        }
      }
    }
  }
)

watch(
  () => refStore.focusRef,
  (fr) => {
    if (fr && chatOpen.value) {
      resourcePanelOpen.value = true
    }
  }
)

// Splitting handlers
function startHorizontalDrag(e: MouseEvent) {
  isDraggingHorizontal.value = true
  document.addEventListener('mousemove', onHorizontalDrag)
  document.addEventListener('mouseup', stopHorizontalDrag)
  e.preventDefault()
}

function onHorizontalDrag(e: MouseEvent) {
  if (!isDraggingHorizontal.value || !contentWrapperRef.value) return
  const rect = contentWrapperRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const pct = (x / rect.width) * 100
  leftColumnWidth.value = Math.min(50, Math.max(25, pct))
}

function stopHorizontalDrag() {
  isDraggingHorizontal.value = false
  document.removeEventListener('mousemove', onHorizontalDrag)
  document.removeEventListener('mouseup', stopHorizontalDrag)
}

function startVerticalDrag(e: MouseEvent) {
  isDraggingVertical.value = true
  document.addEventListener('mousemove', onVerticalDrag)
  document.addEventListener('mouseup', stopVerticalDrag)
  e.preventDefault()
}

function onVerticalDrag(e: MouseEvent) {
  if (!isDraggingVertical.value || !leftColumnRef.value) return
  const parent = leftColumnRef.value.parentElement
  if (!parent) return
  const rect = parent.getBoundingClientRect()
  const y = e.clientY - rect.top
  const pct = (y / rect.height) * 100
  topPanelHeight.value = Math.min(75, Math.max(15, pct))
}

function stopVerticalDrag() {
  isDraggingVertical.value = false
  document.removeEventListener('mousemove', onVerticalDrag)
  document.removeEventListener('mouseup', stopVerticalDrag)
}

function clickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.conv-selector-wrapper')) {
    showConvDropdown.value = false
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ro-RO', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

// Lifecycle Hooks
onMounted(async () => {
  await conversationStore.load()
  if (canvasRef.value) {
    canvasRef.value.width = canvasRef.value.offsetWidth
    canvasRef.value.height = canvasRef.value.offsetHeight
    drawVisualizer()
  }
  window.addEventListener('click', clickOutside)
})

onUnmounted(() => {
  cleanupVisualizer()
  window.removeEventListener('click', clickOutside)
  if (realtimeChannel) unsubscribe(realtimeChannel)
})
</script>

<template>
  <div class="audio-call-container" :class="{ 'p-6': !chatOpen }">

    <!-- Animated background glows -->
    <div class="bg-glow bg-glow--left"></div>
    <div class="bg-glow bg-glow--right"></div>

    <!-- Subtle grid overlay -->
    <div class="grid-overlay"></div>

    <!-- Hidden audio element -->
    <audio ref="audioRef" autoplay></audio>

    <div 
      ref="contentWrapperRef" 
      class="content-wrapper" 
      :class="{ 'chat-mode-active': chatOpen }"
      :style="chatOpen ? { '--left-col-width': leftColumnWidth + '%', '--top-panel-height': topPanelHeight + '%' } : {}"
    >
      <!-- LEFT SIDE CONTAINER -->
      <div class="left-side-container">
        <!-- COLUMN 1 (LEFT / TOP PANEL): Controls and Visualizer -->
        <div ref="leftColumnRef" class="control-column">
        <!-- Top Title section -->
        <header class="page-header">
        
          <h1 class="page-title">
            Curs Live ClassMonitor
          </h1>
          <p v-if="!chatOpen" class="page-subtitle">
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
          <div v-if="status === 'connected' && !chatOpen" class="connection-details">
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

            <input type="range" min="0" max="100" :value="volume" :style="{ '--progress': `${volume}%` }" @input="handleVolumeChange" class="volume-slider" />

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

            <!-- Toggle Chat Button -->
            <button 
              @click="toggleChat"
              class="btn btn--chat"
              :class="{ 'btn--chat-active': chatOpen }"
              title="Comută interfața de chat cu AI-ul și resursele cursului"
            >
              <span class="chat-btn-icon">{{ chatOpen ? '✕' : '💬' }}</span>
              <span>{{ chatOpen ? 'Închide Chat' : 'Chat Curs' }}</span>
            </button>
          </div>
        </footer>
      </div>

      <!-- VERTICAL SPLITTER: Only in chatOpen mode -->
      <div 
        v-if="chatOpen" 
        class="drag-handle-vertical"
        :class="{ 'drag-handle-vertical--dragging': isDraggingVertical }"
        @mousedown="startVerticalDrag"
      >
        <div class="drag-handle-vertical-bar" />
      </div>

      <!-- COLUMN 2 (RIGHT / BOTTOM PANEL): Live Transcript -->
      <section class="transcript-column">
        <div class="transcript-header">
          <span class="transcript-title">
            <span class="transcript-dot" :class="{ 'transcript-dot--live': isListening }"></span>
            Transcriere Live
          </span>
          <div class="transcript-header-actions">
            <!-- Reference Action Buttons when segments are selected -->
            <template v-if="selectedSegmentIds.size > 0">
              <button
                @click="referenceSelectedSegments"
                class="reference-action-btn reference-action-btn--primary animate-pulse-once"
                title="Adaugă segmentele selectate ca referință în chat"
              >
                <span>Referențiază în Chat ({{ selectedSegmentIds.size }})</span>
              </button>
              <button
                @click="clearSegmentSelection"
                class="reference-action-btn reference-action-btn--secondary"
                title="Resetează selecția"
              >
                Anulează
              </button>
            </template>

            <!-- Default Header actions when no segments are selected -->
            <template v-else>
              <!-- Autoscroll toggle button -->
              <button
                @click="autoScrollEnabled = !autoScrollEnabled"
                class="autoscroll-btn"
                :class="{ 'autoscroll-btn--active': autoScrollEnabled }"
                title="Activează/Dezactivează auto-scroll la ultimele transcrieri"
              >
                <svg class="autoscroll-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
                <span>Auto-Scroll</span>
              </button>
              <span v-if="segments.length && !chatOpen" class="transcript-count">{{ segments.length }} segmente</span>
            </template>
          </div>
        </div>

        <!-- Loading error -->
        <div v-if="loadError" class="transcript-error">{{ loadError }}</div>

        <!-- Connected empty state -->
        <div v-else-if="!segments.length" class="transcript-empty">
          <span class="transcript-empty-icon">🎙️</span>
          <span>Așteptând transcrierea... Cursul nu a început sau nu s-a detectat audio.</span>
        </div>

        <!-- Segments list -->
        <div v-else ref="transcriptPanelRef" class="transcript-scroll">
          <div
            v-for="seg in segments"
            :key="seg.id"
            class="transcript-segment"
            :class="{ 
              'transcript-segment--preliminary': !seg.is_final,
              'transcript-segment--selected': selectedSegmentIds.has(seg.id)
            }"
            @click="toggleSegmentSelection(seg.id)"
          >
            <!-- Checkbox column -->
            <div class="segment-checkbox-wrapper" @click.stop>
              <input 
                type="checkbox" 
                :checked="selectedSegmentIds.has(seg.id)" 
                @change="toggleSegmentSelection(seg.id)"
                class="segment-checkbox"
              />
            </div>

            <span class="transcript-time">{{ formatTime(seg.segment_start) }}</span>
            <span class="transcript-text">
              {{ seg.text }}
              <span v-if="!seg.is_final" class="transcript-cursor">▋</span>
            </span>
          </div>
        </div>
      </section>
      </div>

      <!-- HORIZONTAL SPLITTER: Only in chatOpen mode -->
      <div 
        v-if="chatOpen" 
        class="drag-handle-horizontal"
        :class="{ 'drag-handle-horizontal--dragging': isDraggingHorizontal }"
        @mousedown="startHorizontalDrag"
      >
        <div class="drag-handle-horizontal-bar" />
      </div>

      <!-- COLUMN 3 (EMBEDDED CHAT COLUMN): Only in chatOpen mode -->
      <div 
        v-if="chatOpen" 
        class="embedded-chat-column"
      >
        <div ref="chatSplitRef" class="chat-split-container" :class="{ 'is-dragging': isDraggingChatSplit }">
          
          <!-- Embedded Chat main panel -->
          <div 
            class="chat-main-panel"
            :style="resourcePanelOpen ? { width: chatPanelWidth + '%' } : { width: '100%' }"
          >
            <!-- Chat top bar -->
            <div class="embedded-chat-topbar">
              <div class="chat-topbar-left">
                <!-- Dropdown Conversation Selector -->
                <div class="conv-selector-wrapper">
                  <button @click.stop="showConvDropdown = !showConvDropdown" class="conv-selector-btn">
                    <span class="conv-selector-title">
                      {{ activeConversation ? activeConversation.title : 'Conversație Nouă' }}
                    </span>
                    <svg class="dropdown-chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  
                  <div v-if="showConvDropdown" class="conv-dropdown-menu">
                    <div class="conv-dropdown-header">
                      <span>Conversații recente</span>
                      <button @click.stop="startNewEmbeddedChat" class="conv-new-btn-inline" title="Începe o conversație nouă">
                        + Nou
                      </button>
                    </div>
                    <div class="conv-dropdown-list">
                      <div 
                        v-for="c in recentConversations" 
                        :key="c.id" 
                        class="conv-dropdown-item"
                        :class="{ 'conv-dropdown-item--active': c.id === embeddedActiveId }"
                        @click.stop="selectEmbeddedConversation(c.id)"
                      >
                        <span class="conv-item-title">{{ c.title }}</span>
                        <span class="conv-item-date">{{ formatDate(c.updatedAt || c.createdAt) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="chat-topbar-center">
                <ModelSelector />
              </div>

              <div class="chat-topbar-right">
                <button
                  class="resources-toggle-btn"
                  :class="{ 'resources-toggle-btn--active': resourcePanelOpen }"
                  title="Resurse curs"
                  @click="toggleResourcePanel"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                  <span class="resources-text">Resurse</span>
                </button>
              </div>
            </div>

            <!-- Chat Content (Messages & Input) -->
            <div class="chat-content-container">
              <ChatMessages class="chat-messages" @regenerate="handleRegenerate" />
              <ChatInput
                :conversation-id="embeddedActiveId ?? ''"
                class="chat-input-area"
                @send="handleSend"
                @abort="abort"
              />
            </div>
          </div>

          <!-- Drag handle inside chat -->
          <div 
            v-if="resourcePanelOpen" 
            class="drag-handle-chat"
            :class="{ 'drag-handle-chat--dragging': isDraggingChatSplit }"
            @mousedown="startChatDrag"
          >
            <div class="drag-handle-chat-bar" />
          </div>

          <!-- Resource panel inside chat -->
          <Transition name="panel-slide">
            <div 
              v-show="resourcePanelOpen" 
              class="embedded-resource-panel"
              :style="{ width: (100 - chatPanelWidth) + '%' }"
            >
              <ResourcesPanel @send-message="handleSendMessage" />
            </div>
          </Transition>

        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ── Container ───────────────────────────────────────────────────────────── */
.audio-call-container {
  @apply flex flex-col h-full w-full overflow-hidden relative
         bg-transparent text-slate-900 dark:text-surface-950;
  font-family: 'Inter', 'Outfit', sans-serif;
  z-index: 10;
}

/* ── Animated background glows ───────────────────────────────────────────── */
.bg-glow {
  @apply absolute rounded-full pointer-events-none z-0;
  filter: blur(120px);
  animation: glow-drift 8s ease-in-out infinite alternate;
}
.bg-glow--left {
  @apply w-[420px] h-[420px] -top-20 -left-[100px];
  background: radial-gradient(circle, rgba(92,114,243,0.18) 0%, transparent 70%);
  animation-delay: 0s;
}
.bg-glow--right {
  @apply w-[380px] h-[380px] -bottom-[60px] -right-20;
  background: radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%);
  animation-delay: -4s;
}
@keyframes glow-drift {
  0%   { transform: translate(0, 0) scale(1); }
  100% { transform: translate(30px, 20px) scale(1.08); }
}

/* ── Grid overlay ────────────────────────────────────────────────────────── */
.grid-overlay {
  @apply absolute inset-0 pointer-events-none z-0;
  background-image:
    linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 3rem 3rem;
  mask-image: radial-gradient(ellipse 65% 55% at 50% 50%, #000 60%, transparent 100%);
}

/* ── Content ─────────────────────────────────────────────────────────────── */
.content-wrapper {
  @apply relative z-10 flex-1 w-full h-full flex flex-row justify-between overflow-hidden box-border;
}

.left-side-container {
  @apply flex flex-row justify-between gap-10 w-full h-full;
}

.control-column {
  @apply flex flex-col justify-between gap-8 h-full min-w-0;
  flex: 1 1 45%;
}

.transcript-column {
  @apply flex flex-col gap-5 h-full min-w-0 overflow-hidden;
  flex: 1.2 1 55%;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.page-header {
  @apply flex flex-col items-center gap-2 text-center;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
.page-title {
  @apply text-3xl font-extrabold tracking-tight m-0;
  background: linear-gradient(135deg, #e8eaf0 0%, #a4b9fc 50%, #c4c9d4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.page-subtitle {
  @apply text-xs max-w-lg m-0 leading-relaxed text-surface-500 dark:text-surface-800;
}

/* ── Visualizer ──────────────────────────────────────────────────────────── */
.visualizer-section {
  @apply flex flex-col items-center gap-4 flex-shrink-0 w-full;
}
.visualizer-card {
  @apply relative w-full max-w-2xl aspect-[21/9] rounded-3xl p-6 overflow-hidden
         flex flex-col items-center justify-center shadow-2xl
         bg-surface-900/60 dark:bg-surface-50/50 border border-surface-800 dark:border-surface-200/30;
  backdrop-filter: blur(20px);
}
.card-glow {
  @apply absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full pointer-events-none transition-all duration-500;
  background: rgba(92, 114, 243, 0.12);
  filter: blur(60px);
}
.card-glow--connected { @apply w-64 h-64; background: rgba(16, 185, 129, 0.12); }
.card-glow--failed    { background: rgba(239, 68, 68, 0.12); }

.visualizer-canvas {
  @apply relative w-full h-24 z-10 pointer-events-none;
}

/* ── Status indicator ────────────────────────────────────────────────────── */
.status-indicator {
  @apply absolute bottom-5 flex flex-col items-center gap-1.5 z-10;
}
.status-circle {
  @apply w-16 h-16 rounded-full flex items-center justify-center relative transition-all duration-300;
}
.status-circle--disconnected { @apply bg-surface-800 dark:bg-surface-100/10 border border-surface-900 dark:border-surface-300/10; }
.status-circle--connecting   { @apply bg-accent-500/15 border border-accent-500/30 animate-pulse; }
.status-circle--connected    { @apply bg-emerald-500/20 border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]; }
.status-circle--failed       { @apply bg-red-500/20 border border-red-500/40; }
@keyframes subtle-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(92,114,243,0.3); }
  50%       { box-shadow: 0 0 0 8px rgba(92,114,243,0); }
}
.ripple {
  @apply absolute inset-0 rounded-full opacity-50;
  animation: ping 1.2s cubic-bezier(0,0,0.2,1) infinite;
}
.ripple--green  { @apply border border-emerald-500/50; }
.ripple--indigo { @apply border border-accent-500/50; }
@keyframes ping {
  75%, 100% { transform: scale(1.6); opacity: 0; }
}
.status-icon { @apply text-2xl relative z-10; }
.status-label {
  @apply text-[10px] font-semibold tracking-widest uppercase transition-colors duration-300 mt-1;
}
.status-label--disconnected { @apply text-surface-500 dark:text-surface-800; }
.status-label--connecting   { @apply text-accent-500 dark:text-accent-400; }
.status-label--connected    { @apply text-emerald-500 dark:text-emerald-400; }
.status-label--failed       { @apply text-red-500 dark:text-red-400; }

/* ── Connection details ──────────────────────────────────────────────────── */
.connection-details {
  @apply flex gap-6 text-[10px] font-mono text-surface-500 dark:text-surface-800 tracking-wide;
}

/* ── Error ───────────────────────────────────────────────────────────────── */
.error-alert {
  @apply w-full max-w-md bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-500 dark:text-red-400 text-center;
}

/* ── Live Transcript Panel ───────────────────────────────────────────────── */
.transcript-column {
  @apply w-full flex flex-col gap-3 flex-1 min-h-0 h-full;
}

.transcript-header {
  @apply flex items-center justify-between px-1;
}

.transcript-title {
  @apply flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-surface-500 dark:text-surface-800;
}

.transcript-dot {
  @apply w-1.5 h-1.5 rounded-full bg-surface-300 dark:bg-surface-600 transition-all duration-300;
}
.transcript-dot--live {
  @apply bg-emerald-500 shadow-[0_0_6px_rgba(74,222,128,0.7)] animate-pulse;
}

.transcript-header-actions {
  @apply flex items-center gap-4;
}

.autoscroll-btn {
  @apply inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer
         bg-surface-900 dark:bg-surface-50 border border-surface-800 dark:border-surface-200/50
         text-surface-600 dark:text-surface-800 hover:bg-surface-800 dark:hover:bg-surface-100/10
         hover:text-surface-50 dark:hover:text-surface-950 transition-all duration-150 ease-out;
}

.autoscroll-btn:hover {
  @apply bg-surface-800 dark:bg-surface-100/10 border-surface-900 dark:border-surface-200/80;
}

.autoscroll-btn--active {
  @apply bg-accent-500/10 border-accent-500/30 text-accent-600 dark:text-accent-400;
}

.autoscroll-btn--active:hover {
  @apply bg-accent-500/20 border-accent-500/50 text-accent-700 dark:text-accent-300;
}

.autoscroll-icon {
  @apply transition-transform duration-300;
}

.autoscroll-btn--active .autoscroll-icon {
  @apply translate-y-[1px];
}

.transcript-count {
  @apply text-[10px] font-mono text-surface-500 dark:text-surface-800 tracking-wide;
}

.transcript-error {
  @apply text-xs text-red-500 dark:text-red-400 p-3 bg-red-500/10 border border-red-500/20 rounded-xl;
}

.transcript-empty {
  @apply flex-1 flex flex-col items-center justify-center gap-3 p-10 text-xs text-surface-500 dark:text-surface-800 text-center
         rounded-2xl border border-dashed border-surface-800 dark:border-surface-300/30
         bg-surface-900/50 dark:bg-surface-50/10;
  backdrop-filter: blur(12px);
}
.transcript-empty-icon { @apply text-2xl; }

.transcript-scroll {
  @apply flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 p-3 rounded-2xl
         bg-surface-900/85 dark:bg-surface-50/30 border border-surface-800 dark:border-surface-200/10;
  backdrop-filter: blur(12px);
  scroll-behavior: smooth;
}
.transcript-scroll::-webkit-scrollbar {
  @apply w-1;
}
.transcript-scroll::-webkit-scrollbar-track {
  @apply bg-transparent;
}
.transcript-scroll::-webkit-scrollbar-thumb {
  @apply bg-surface-800 dark:bg-surface-600 rounded-full;
}

.transcript-segment {
  @apply flex gap-2.5 items-baseline transition-all duration-200 p-1 py-1.5 px-3 rounded-xl cursor-pointer select-none hover:bg-surface-800/50 dark:hover:bg-surface-100/10;
  animation: segment-in 0.25s ease;
}

.transcript-segment--preliminary {
  @apply opacity-50;
}

.transcript-segment--selected {
  @apply bg-accent-500/10 dark:bg-accent-500/15 border border-accent-500/25 dark:border-accent-500/30 hover:bg-accent-500/20 dark:hover:bg-accent-500/25;
}

.segment-checkbox-wrapper {
  @apply flex items-center justify-center self-center flex-shrink-0 mr-1;
}

.segment-checkbox {
  @apply w-3.5 h-3.5 rounded border-surface-800 dark:border-surface-600 text-accent-500 focus:ring-accent-500 cursor-pointer transition-all duration-150;
  accent-color: var(--accent-500, #5c72f3);
}

.reference-action-btn {
  @apply inline-flex items-center justify-center px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all duration-150 ease-out;
}

.reference-action-btn--primary {
  @apply bg-accent-500 text-white hover:bg-accent-600 shadow-sm hover:shadow-[0_4px_12px_rgba(92,114,243,0.3)];
}

.reference-action-btn--secondary {
  @apply bg-surface-900 dark:bg-surface-50 border border-surface-800 dark:border-surface-200/50 text-surface-600 dark:text-surface-800 hover:text-surface-50 dark:hover:text-surface-950 hover:bg-surface-800 dark:hover:bg-surface-100/10;
}

.animate-pulse-once {
  animation: pulse-once 1s ease-out 1;
}

@keyframes pulse-once {
  0% { box-shadow: 0 0 0 0 rgba(92, 114, 243, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(92, 114, 243, 0); }
  100% { box-shadow: 0 0 0 0 rgba(92, 114, 243, 0); }
}

@keyframes segment-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.transcript-time {
  @apply flex-shrink-0 text-[10px] font-mono text-surface-600 dark:text-surface-800 pt-0.5;
}

.transcript-text {
  @apply text-sm text-surface-100 dark:text-surface-950 leading-relaxed;
}

.transcript-cursor {
  @apply inline-block text-accent-500 ml-0.5;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* ── Controls footer ─────────────────────────────────────────────────────── */
.controls-footer {
  @apply flex flex-col items-center gap-5 flex-shrink-0;
}
.volume-panel {
  @apply w-full max-w-xs flex items-center gap-3 p-3 px-5 rounded-2xl
         bg-surface-900/80 dark:bg-surface-50/30 border border-surface-800 dark:border-surface-200/10;
  backdrop-filter: blur(12px);
}
.mute-btn {
  @apply bg-transparent border-0 cursor-pointer text-surface-500 dark:text-surface-400 p-1.5 rounded-lg
         flex items-center justify-center hover:bg-surface-800 dark:hover:bg-surface-100/10 hover:text-surface-50 dark:hover:text-surface-950 transition-colors duration-150;
}
.volume-slider {
  @apply flex-1 accent-accent-500 h-1 rounded-full bg-surface-800 dark:bg-surface-600 cursor-pointer outline-none;
  appearance: none;
  background-image: linear-gradient(to right, #5c72f3 var(--progress, 0%), transparent var(--progress, 0%)) !important;
}
.volume-slider::-webkit-slider-runnable-track {
  @apply w-full h-full rounded-full;
  background-image: linear-gradient(to right, #5c72f3 var(--progress, 0%), transparent var(--progress, 0%)) !important;
}
.volume-slider::-webkit-slider-thumb {
  @apply w-3.5 h-3.5 rounded-full bg-accent-500 shadow-[0_0_6px_rgba(92,114,243,0.5)] cursor-pointer border-none;
  appearance: none;
}
.volume-slider::-moz-range-thumb {
  @apply w-3.5 h-3.5 rounded-full bg-accent-500 shadow-[0_0_6px_rgba(92,114,243,0.5)] cursor-pointer border-none;
}
.volume-value {
  @apply text-[10px] font-mono text-surface-500 dark:text-surface-800 w-10 text-right;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.action-row { @apply flex items-center gap-4; }
.btn {
  @apply px-8 py-3 rounded-xl font-bold text-sm tracking-wide border-0 cursor-pointer
         flex items-center gap-2 transition-all duration-200;
}
.btn--connect {
  @apply bg-gradient-to-r from-accent-600 to-accent-400 text-white shadow-[0_8px_24px_rgba(92,114,243,0.3)]
         hover:from-accent-700 hover:to-accent-500 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(92,114,243,0.4)];
}
.btn--loading {
  @apply bg-surface-900 dark:bg-surface-50 border border-surface-800 dark:border-surface-200/50 text-surface-500 dark:text-surface-500 cursor-not-allowed;
}
.btn--disconnect {
  @apply bg-gradient-to-r from-red-500 to-red-600 text-white shadow-[0_8px_24px_rgba(239,68,68,0.25)]
         hover:from-red-600 hover:to-red-700 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(239,68,68,0.35)];
}
.spinner {
  @apply w-4 h-4 rounded-full border-2 border-surface-200 dark:border-surface-700 border-t-accent-400 animate-spin;
}

/* ── Chat Toggle Button ── */
.btn--chat {
  @apply bg-surface-900 dark:bg-surface-50/50 border border-surface-800 dark:border-surface-200/30 text-surface-600 dark:text-surface-800 shadow-md;
}
.btn--chat:hover {
  @apply bg-surface-800 dark:bg-surface-100/10 text-surface-50 dark:text-surface-950 border-surface-900 dark:border-surface-200/50;
}
.btn--chat-active {
  @apply bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white border-0 shadow-[0_8px_24px_rgba(236,72,153,0.35)]
         hover:from-pink-600 hover:to-fuchsia-600 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(236,72,153,0.45)];
}
.chat-btn-icon {
  @apply mr-1;
}

/* ── Split Drag Handles ── */
.drag-handle-horizontal {
  @apply relative w-1 h-full cursor-col-resize z-30 flex items-center justify-center
         bg-surface-200 dark:bg-surface-200/30
         hover:bg-accent-500 dark:hover:bg-accent-400 transition-colors duration-150;
  grid-column: 2;
  grid-row: 1;
}
.drag-handle-horizontal--dragging {
  @apply bg-accent-500 dark:bg-accent-400;
}
.drag-handle-horizontal-bar {
  @apply w-0.5 h-8 rounded-full bg-surface-500 dark:bg-surface-400 opacity-60 transition-colors duration-150;
}
.drag-handle-horizontal:hover .drag-handle-horizontal-bar,
.drag-handle-horizontal--dragging .drag-handle-horizontal-bar {
  @apply bg-white dark:bg-white;
}

.drag-handle-vertical {
  @apply relative h-1 w-full cursor-row-resize z-30 flex items-center justify-center
         bg-surface-200 dark:bg-surface-200/30
         hover:bg-accent-500 dark:hover:bg-accent-400 transition-colors duration-150;
  grid-row: 2;
  grid-column: 1;
}
.drag-handle-vertical--dragging {
  @apply bg-accent-500 dark:bg-accent-400;
}
.drag-handle-vertical-bar {
  @apply w-8 h-0.5 rounded-full bg-surface-500 dark:bg-surface-400 opacity-60 transition-colors duration-150;
}
.drag-handle-vertical:hover .drag-handle-vertical-bar,
.drag-handle-vertical--dragging .drag-handle-vertical-bar {
  @apply bg-white dark:bg-white;
}

/* ── Combined layout rules ── */
.content-wrapper.chat-mode-active {
  display: grid;
  grid-template-columns: var(--left-col-width, 35%) 4px 1fr;
  grid-template-rows: 1fr;
  gap: 0;
}

.chat-mode-active .left-side-container {
  display: grid;
  grid-template-rows: var(--top-panel-height, 15%) 4px 1fr;
  grid-template-columns: 1fr;
  height: 100%;
  overflow: hidden;
  gap: 0;
}

.embedded-chat-column {
  @apply h-full overflow-hidden flex flex-col
         bg-surface-950 dark:bg-surface-50/50 border border-surface-800 dark:border-surface-200/30;
  backdrop-filter: blur(20px);
  grid-column: 3;
  grid-row: 1;
}

/* Adjustments for compressed left visualizer panel in chat mode */
.chat-mode-active .control-column {
  @apply flex flex-col justify-start gap-2 p-4 h-full box-border
         bg-surface-950 dark:bg-surface-50/50 border border-surface-800 dark:border-surface-200/30;
  backdrop-filter: blur(20px);
  grid-row: 1;
  grid-column: 1;
}
.chat-mode-active .control-column .page-header {
  @apply items-start text-left gap-1;
}
.chat-mode-active .control-column .page-title {
  @apply text-base font-bold text-left;
}
.chat-mode-active .control-column .page-subtitle {
  @apply hidden;
}
.chat-mode-active .control-column .visualizer-section {
  @apply flex flex-col gap-0 p-0 m-0 h-auto;
}
.chat-mode-active .control-column .visualizer-card {
  @apply bg-transparent border-0 p-0 shadow-none rounded-none relative h-5 overflow-hidden flex items-center justify-center aspect-auto;
}
.chat-mode-active .control-column .visualizer-canvas {
  @apply h-3.5 bg-surface-800/10 dark:bg-surface-100/5 rounded border border-surface-900/20 dark:border-surface-200/5;
}
.chat-mode-active .control-column .status-indicator {
  @apply hidden;
}
.chat-mode-active .control-column .connection-details {
  @apply hidden;
}
.chat-mode-active .control-column .controls-footer {
  @apply flex flex-row items-center justify-between gap-4 w-full mt-0.5;
}
.chat-mode-active .control-column .volume-panel {
  @apply flex items-center gap-1.5 p-1 px-2 rounded bg-surface-800/20 dark:bg-surface-100/5 border border-surface-900/20 dark:border-surface-200/5 flex-1;
}
.chat-mode-active .control-column .volume-slider {
  @apply h-0.5;
}
.chat-mode-active .control-column .mute-btn {
  @apply p-0.5;
}
.chat-mode-active .control-column .mute-btn svg {
  @apply w-3.5 h-3.5;
}
.chat-mode-active .control-column .volume-value {
  @apply hidden;
}
.chat-mode-active .control-column .action-row {
  @apply flex items-center gap-2;
}
.chat-mode-active .control-column .btn {
  @apply p-1.5 px-3 text-xs rounded-lg font-semibold;
}

/* Adjustments for transcripts panel in chat mode */
.chat-mode-active .transcript-column {
  @apply p-5 box-border h-full overflow-hidden
         bg-surface-950 dark:bg-surface-50/50 border border-surface-800 dark:border-surface-200/30;
  backdrop-filter: blur(20px);
  grid-row: 3;
  grid-column: 1;
}
.chat-mode-active .transcript-scroll {
  @apply bg-transparent border-0 p-0 rounded-none backdrop-filter-none;
}

/* ── Embedded Chat Area Styles ── */
.chat-split-container {
  @apply flex w-full h-full overflow-hidden relative;
}
.chat-split-container.is-dragging {
  @apply select-none cursor-col-resize;
}

.chat-main-panel {
  @apply flex flex-col h-full min-w-0 flex-shrink-0;
  container-type: inline-size;
}

.chat-content-container {
  @apply flex flex-col flex-1 min-h-0 overflow-hidden;
}

.chat-messages {
  @apply flex-1 min-h-0;
}

.chat-input-area {
  @apply flex-shrink-0;
}

/* Top bar / header inside embedded chat */
.embedded-chat-topbar {
  @apply flex items-center justify-between p-3 px-6 relative z-20 gap-4 flex-shrink-0
         border-b border-surface-800 dark:border-surface-200/30 bg-surface-900 dark:bg-surface-50/10;
  backdrop-filter: blur(10px);
}
.chat-topbar-left {
  @apply flex-1 min-w-0;
}
.chat-topbar-center {
  @apply flex items-center justify-center;
}
.chat-topbar-right {
  @apply flex-1 flex items-center justify-end gap-3;
}

/* Conversation Dropdown Selector */
.conv-selector-wrapper {
  @apply relative inline-block min-w-0 max-w-[14rem];
}

.conv-selector-btn {
  @apply inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer max-w-full transition-all duration-150
         bg-surface-900 dark:bg-surface-100/10 border border-surface-800 dark:border-surface-200/10
         text-surface-50 dark:text-surface-950 hover:bg-surface-800 dark:hover:bg-surface-100/20 hover:text-surface-50 dark:hover:text-surface-900;
}

.conv-selector-title {
  @apply truncate flex-1 min-w-0;
}

.dropdown-chevron-icon {
  @apply flex-shrink-0 text-surface-500 dark:text-surface-400;
}

/* Dropdown Menu */
.conv-dropdown-menu {
  @apply absolute left-0 w-72 rounded-xl shadow-2xl overflow-hidden z-[50]
         bg-surface-950 dark:bg-surface-0 border border-surface-800 dark:border-surface-200/50;
  top: calc(100% + 6px);
  backdrop-filter: blur(20px);
  animation: dropdown-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes dropdown-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.conv-dropdown-header {
  @apply flex items-center justify-between p-2 px-3 text-[10px] font-bold uppercase tracking-wider
         border-b border-surface-800 dark:border-surface-200/30 text-surface-500 dark:text-surface-800;
}

.conv-new-btn-inline {
  @apply border-0 text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-opacity duration-150
         bg-gradient-to-r from-accent-600 to-accent-400 text-white hover:opacity-90;
}

.conv-dropdown-list {
  @apply max-h-60 overflow-y-auto p-1.5 flex flex-col gap-1;
}
.conv-dropdown-list::-webkit-scrollbar {
  @apply w-1;
}
.conv-dropdown-list::-webkit-scrollbar-thumb {
  @apply bg-surface-800 dark:bg-surface-600 rounded-full;
}

.conv-dropdown-item {
  @apply flex flex-col gap-0.5 p-2 px-2.5 rounded-lg cursor-pointer transition-colors duration-150
         hover:bg-surface-900 dark:hover:bg-surface-100/10;
}
.conv-dropdown-item:hover {
  @apply bg-surface-800 dark:bg-surface-100/5;
}
.conv-dropdown-item--active {
  @apply bg-accent-500/10;
}
.conv-dropdown-item--active .conv-item-title {
  @apply text-accent-600 dark:text-accent-400;
}

.conv-item-title {
  @apply text-xs font-semibold truncate text-surface-50 dark:text-surface-950;
}
.conv-item-date {
  @apply text-[9px] font-mono text-surface-500 dark:text-surface-800;
}

/* Resources toggle button */
.resources-toggle-btn {
  @apply flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150
         bg-surface-900 dark:bg-surface-100/10 border border-surface-800 dark:border-surface-200/10
         text-surface-50 dark:text-surface-950 hover:bg-surface-800 dark:hover:bg-surface-100/20 hover:text-surface-50 dark:hover:text-surface-900;
}
.resources-toggle-btn--active {
  @apply bg-accent-500/10 border-accent-500/30 text-accent-600 dark:text-accent-400;
}

/* Drag splitter handle inside chat */
.drag-handle-chat {
  @apply relative w-1 h-full cursor-col-resize z-10 flex items-center justify-center
         bg-surface-200 dark:bg-surface-200/30
         hover:bg-accent-500 dark:hover:bg-accent-400 transition-colors duration-150;
  flex-shrink: 0;
}
.drag-handle-chat--dragging {
  @apply bg-accent-500 dark:bg-accent-400;
}
.drag-handle-chat-bar {
  @apply w-0.5 h-8 rounded-full bg-surface-500 dark:bg-surface-400 opacity-60 transition-colors duration-150;
}
.drag-handle-chat:hover .drag-handle-chat-bar,
.drag-handle-chat--dragging .drag-handle-chat-bar {
  @apply bg-white dark:bg-white;
}

.embedded-resource-panel {
  @apply flex-shrink-0 overflow-hidden min-w-0 h-full;
}

/* Slide transition for resources panel */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  width: 0 !important;
  opacity: 0;
}

@container (max-width: 540px) {
  .embedded-chat-topbar {
    @apply flex-wrap gap-y-2 py-2 px-3 justify-center;
  }
  .chat-topbar-left, .chat-topbar-center, .chat-topbar-right {
    @apply flex-none w-auto justify-center;
  }
  .chat-topbar-right {
    @apply flex items-center justify-end gap-1.5;
  }
  .resources-text {
    display: none;
  }
  .resources-toggle-btn {
    @apply p-1.5 px-2.5;
  }
}
</style>
