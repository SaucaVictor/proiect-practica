<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useReferencesStore } from '@/stores/references.store'
import { useAttachments } from '@/composables/useAttachments'
import { useKeyboard } from '@/composables/useKeyboard'
import Button from '@/components/ui/Button.vue'

defineProps<{
  conversationId: string
}>()

const emit = defineEmits<{
  send: [content: string, attachments: any[], metadata?: Record<string, any>]
  abort: []
}>()

const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const refStore = useReferencesStore()

const {
  isStreaming,
  asrMode,
  processing,
  processingStatus,
  processingProgress,
  processingFileName,
} = storeToRefs(chatStore)
const toggleAsrMode = () => chatStore.toggleAsrMode()
const { current: settings } = storeToRefs(settingsStore)
const { pending: pendingRefs } = storeToRefs(refStore)

const {
  pendingAttachments,
  hasAttachments,
  isDragging,
  handleDrop,
  handleDragOver,
  handleDragLeave,
  handleFileInput,
  removeAttachment,
  clearAttachments,
} = useAttachments()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const input = ref('')
const rows = ref(1)

const hasRefs = computed(() => pendingRefs.value.length > 0)
const canSend = computed(
  () => (input.value.trim().length > 0 || hasAttachments.value || hasRefs.value) && !isStreaming.value
)

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  const newRows = Math.min(Math.max(Math.ceil(el.scrollHeight / 24), 1), 10)
  rows.value = newRows
  el.style.height = `${el.scrollHeight}px`
}

watch(input, () => nextTick(autoResize))

function handleKeydown(event: KeyboardEvent) {
  const sendOnEnter = settings.value.sendOnEnter

  if (sendOnEnter) {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey) {
      event.preventDefault()
      if (canSend.value) submit()
      return
    }
  } else {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      if (canSend.value) submit()
      return
    }
  }
}

function submit() {
  if (!canSend.value) return
  const content = input.value.trim()
  const references = [...pendingRefs.value]
  const attachmentsCopy = [...pendingAttachments.value]
  input.value = ''
  rows.value = 1
  if (textareaRef.value) textareaRef.value.style.height = 'auto'
  refStore.clearReferences()
  emit('send', content, attachmentsCopy, { references })
  clearAttachments()
}

// Focus a reference chip → signal the panel to scroll to it
function focusRef(ref: (typeof pendingRefs.value)[number]) {
  refStore.focusReference(ref)
}

function removeRef(id: string) {
  refStore.removeReference(id)
}

function refChipIcon(type: string) {
  if (type === 'whole-file') return '📎'
  if (type === 'text-selection') return '✍️'
  if (type === 'pdf-page') return '📄'
  return '🔗'
}

function refChipLabel(r: (typeof pendingRefs.value)[number]) {
  const parts = r.label.split(' › ')
  const file = parts[parts.length - 1]
  if (r.refType === 'pdf-page') return `${file} · p.${r.pageNumber}`
  if (r.refType === 'text-selection') return `"${(r.selectedText ?? '').slice(0, 30)}…"`
  return file
}

useKeyboard([
  {
    combo: 'ctrl+shift+o',
    handler: () => {
      input.value = ''
    },
    prevent: true,
  },
])

function openFilePicker() {
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.multiple = true
  inp.accept = 'image/*,audio/*,.pdf,.txt,.md,.json,.js,.ts,.py,.html,.css,.csv,.xml,.yaml,.yml'
  inp.onchange = handleFileInput
  inp.click()
}
</script>

<template>
  <div class="input-area">
    <!-- Drop zone overlay -->
    <Transition name="fade">
      <div v-if="isDragging" class="drop-overlay">
        <div class="drop-content">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M16 8v12M10 14l6-6 6 6M8 22h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <p>Drop files to attach</p>
        </div>
      </div>
    </Transition>

    <!-- Progress Indicator Bar -->
    <Transition name="fade">
      <div v-if="processing" class="progress-bar-container">
        <div class="progress-info">
          <span class="progress-status">
            <svg v-if="processingStatus === 'transcribing'" class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <svg v-else class="animate-bounce-custom" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="capitalize font-semibold">{{ processingStatus }}</span>
            <span class="progress-file truncate">({{ processingFileName }})</span>
          </span>
          <span class="progress-percent font-bold">{{ processingProgress }}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${processingProgress}%` }" />
        </div>
      </div>
    </Transition>

    <div
      class="input-wrapper"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <!-- ── Reference chips ──────────────────────────────────────────── -->
      <div v-if="hasRefs" class="reference-strip">
        <button
          v-for="r in pendingRefs"
          :key="r.id"
          class="ref-chip"
          :title="`Click to view · ${r.label}`"
          @click="focusRef(r)"
        >
          <span class="ref-chip-icon">{{ refChipIcon(r.refType) }}</span>
          <span class="ref-chip-text">{{ refChipLabel(r) }}</span>
          <button
            class="ref-chip-remove"
            :aria-label="`Remove reference ${r.label}`"
            @click.stop="removeRef(r.id)"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
              <path d="M2 2l6 6M8 2l-6 6" />
            </svg>
          </button>
        </button>
      </div>

      <!-- ── Attachment previews ────────────────────────────────────── -->
      <div v-if="hasAttachments" class="attachment-strip">
        <div
          v-for="att in pendingAttachments"
          :key="att.id"
          class="attachment-chip"
        >
          <img v-if="att.type === 'image' && att.previewUrl" :src="att.previewUrl" :alt="att.file.name" class="attachment-thumb" />
          <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2" />
            <path d="M4 4.5h6M4 7h6M4 9.5h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
          </svg>
          <span class="attachment-name">{{ att.file.name }}</span>
          <button :aria-label="`Remove ${att.file.name}`" class="attachment-remove" @click="removeAttachment(att.id)">✕</button>
        </div>
      </div>

      <!-- ── Textarea ───────────────────────────────────────────────── -->
      <textarea
        id="chat-input"
        ref="textareaRef"
        v-model="input"
        :rows="rows"
        placeholder="Message NeuralChat…"
        class="chat-textarea"
        aria-label="Message input"
        @keydown="handleKeydown"
      />

      <!-- ── Toolbar ────────────────────────────────────────────────── -->
      <div class="input-toolbar">
        <!-- Attach button -->
        <button
          id="attach-file-btn"
          class="toolbar-btn"
          aria-label="Attach file"
          title="Attach file"
          type="button"
          @click="openFilePicker"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M13.5 8.5l-6 6a4 4 0 0 1-5.66-5.66l7-7a2.5 2.5 0 0 1 3.54 3.54l-7 7a1 1 0 0 1-1.41-1.41l6-6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
        </button>

        <!-- ASR Mode Toggle -->
        <button
          class="toolbar-btn asr-toggle-btn"
          :class="{ 'local-mode': asrMode === 'local' }"
          :title="asrMode === 'local' ? 'Speech-to-Text: Local Server (FastAPI)' : 'Speech-to-Text: Hugging Face Cloud'"
          type="button"
          @click="toggleAsrMode"
        >
          <svg v-if="asrMode === 'local'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          </svg>
          <span class="asr-badge-text">{{ asrMode === 'local' ? 'ASR: Local' : 'ASR: Cloud' }}</span>
        </button>

        <span class="toolbar-hint">
          {{ settings.sendOnEnter ? 'Enter to send · Shift+Enter for newline' : 'Ctrl+Enter to send' }}
        </span>

        <!-- Abort / Send -->
        <Button
          v-if="isStreaming"
          id="abort-btn"
          variant="secondary"
          size="sm"
          aria-label="Stop generation"
          @click="emit('abort')"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
          </svg>
          Stop
        </Button>
        <Button
          v-else
          id="send-btn"
          variant="primary"
          size="sm"
          :disabled="!canSend"
          aria-label="Send message"
          @click="submit"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M12 7H2M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Send
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-area {
  @apply relative px-4 pb-4 pt-2 flex-shrink-0;
}

.drop-overlay {
  @apply absolute inset-0 z-20 flex items-center justify-center
         bg-surface-100/90 dark:bg-surface-50/90 backdrop-blur-sm
         border-2 border-dashed border-accent-500 rounded-2xl m-2;
}

.drop-content {
  @apply flex flex-col items-center gap-3 text-accent-400 font-medium;
}

.input-wrapper {
  @apply max-w-3xl mx-auto
         bg-surface-100 dark:bg-surface-100
         border border-surface-300 dark:border-surface-300
         rounded-2xl shadow-inner-glow
         flex flex-col overflow-hidden
         focus-within:ring-1 focus-within:ring-accent-500/50
         transition-all duration-150;
}

/* ─── Reference chips ───────────────────────────────────────────────────── */
.reference-strip {
  @apply flex flex-wrap gap-1.5 px-3 pt-2.5;
}

.ref-chip {
  @apply flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-xs font-medium
         bg-accent-500/10 dark:bg-accent-500/20
         text-accent-700 dark:text-accent-300
         border border-accent-500/25 dark:border-accent-500/30
         hover:bg-accent-500/20 dark:hover:bg-accent-500/25
         transition-colors duration-100 cursor-pointer max-w-52;
}

.ref-chip-icon {
  @apply flex-shrink-0 text-sm leading-none;
}

.ref-chip-text {
  @apply truncate flex-1 min-w-0 text-left;
}

.ref-chip-remove {
  @apply flex items-center justify-center w-4 h-4 rounded flex-shrink-0
         text-accent-500/70 hover:text-red-500 hover:bg-red-500/10
         transition-colors duration-100;
}

/* ─── Attachment strip ──────────────────────────────────────────────────── */
.attachment-strip {
  @apply flex flex-wrap gap-2 px-4 pt-3;
}

.attachment-chip {
  @apply flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs
         bg-surface-200 dark:bg-surface-200
         text-surface-800 dark:text-surface-900 max-w-40;
}

.attachment-thumb { @apply w-6 h-6 rounded object-cover flex-shrink-0; }
.attachment-name  { @apply truncate flex-1; }
.attachment-remove { @apply text-surface-600 hover:text-red-400 flex-shrink-0 text-xs; }

/* ─── Textarea ──────────────────────────────────────────────────────────── */
.chat-textarea {
  @apply w-full resize-none bg-transparent
         px-4 py-3 text-sm leading-6
         text-surface-950 dark:text-surface-950
         placeholder:text-surface-600 dark:placeholder:text-surface-600
         focus:outline-none min-h-12 max-h-64;
}

/* ─── Toolbar ───────────────────────────────────────────────────────────── */
.input-toolbar {
  @apply flex items-center gap-2 px-3 py-2.5 border-t border-surface-200 dark:border-surface-200;
}

.toolbar-btn {
  @apply flex items-center justify-center w-7 h-7 rounded-lg
  text-surface-600 dark:text-surface-600
  hover:bg-surface-200 dark:hover:bg-surface-200
  hover:text-surface-950 dark:hover:text-surface-950
  transition-colors duration-150;
}

.asr-toggle-btn {
  @apply gap-1 px-2 w-auto h-7 text-xs font-semibold rounded-lg border border-transparent;
}
.asr-toggle-btn.local-mode {
  @apply bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-600;
}
.asr-toggle-btn:not(.local-mode) {
  @apply bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 hover:text-sky-600;
}
.asr-badge-text {
  @apply uppercase tracking-wider text-[10px] font-bold ml-0.5;
}

.toolbar-hint {
  @apply flex-1 text-xs text-surface-500 dark:text-surface-500 hidden sm:block;
}

/* ─── Progress bar ──────────────────────────────────────────────────────── */
.progress-bar-container {
  @apply max-w-3xl mx-auto mb-2 p-3 rounded-xl
         bg-surface-50 dark:bg-surface-50
         border border-surface-200 dark:border-surface-200
         flex flex-col gap-2 shadow-sm;
}

.progress-info {
  @apply flex items-center justify-between text-xs text-surface-800 dark:text-surface-800;
}

.progress-status { @apply flex items-center gap-2 min-w-0; }
.progress-file   { @apply text-surface-500 dark:text-surface-500 truncate; }
.progress-percent { @apply text-accent-500 dark:text-accent-500 font-bold tabular-nums; }

.progress-track {
  @apply w-full h-1.5 rounded-full bg-surface-200 dark:bg-surface-200 overflow-hidden;
}

.progress-fill {
  @apply h-full rounded-full transition-all duration-300 ease-out;
  background: linear-gradient(90deg, var(--color-accent-400, #3b82f6) 0%, var(--color-accent-600, #2563eb) 50%, var(--color-accent-400, #3b82f6) 100%);
  background-size: 200% 100%;
  animation: shimmer-progress 1.5s infinite linear;
}

@keyframes shimmer-progress {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.animate-spin {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.animate-bounce-custom {
  animation: bounce-custom 1s infinite alternate;
}

@keyframes bounce-custom {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-4px); }
}

/* ─── Fade ──────────────────────────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { @apply transition-opacity duration-200; }
.fade-enter-from, .fade-leave-to { @apply opacity-0; }
</style>
