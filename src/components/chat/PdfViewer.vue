<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

const props = defineProps<{
  url: string
  /** Subject/date/filename for building references */
  subject: string
  date: string
  filename: string
}>()

const emit = defineEmits<{
  'add-reference': [opts: {
    refType: 'pdf-page' | 'text-selection'
    pageNumber?: number
    selectedText?: string
    startOffset?: number
    endOffset?: number
  }]
}>()

// ─── State ───────────────────────────────────────────────────────────────────
const containerRef = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const numPages = ref(0)
const pageRefs = ref<(HTMLDivElement | null)[]>([])
const highlightedPage = ref<number | null>(null)
const pendingScrollPage = ref<number | null>(null)

let pdfDoc: PDFDocumentProxy | null = null

// Selection tooltip
const tooltipVisible = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)
const tooltipPageNum = ref(0)

// ─── Load PDF ─────────────────────────────────────────────────────────────────
async function loadPdf() {
  loading.value = true
  error.value = null
  try {
    const loadingTask = pdfjsLib.getDocument({ url: props.url })
    pdfDoc = await loadingTask.promise
    numPages.value = pdfDoc.numPages
    pageRefs.value = new Array(pdfDoc.numPages).fill(null)

    // Flip loading off BEFORE rendering pages, so the v-else template
    // (with the .pdf-page containers/canvases) actually mounts and
    // pageRefs gets populated with real elements.
    loading.value = false
    await nextTick()

    // Render all pages sequentially
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      await renderPage(i)
    }

    // If we have a buffered scroll request, execute it now that pages are in the DOM
    if (pendingScrollPage.value !== null) {
      scrollToPage(pendingScrollPage.value)
      pendingScrollPage.value = null
    }
  } catch (e: any) {
    error.value = `Failed to load PDF: ${e?.message ?? e}`
    loading.value = false
  }
}

async function renderPage(pageNum: number) {
  if (!pdfDoc) return
  const container = pageRefs.value[pageNum - 1]
  if (!container) return

  const page: PDFPageProxy = await pdfDoc.getPage(pageNum)
  const scale = window.devicePixelRatio > 1 ? 1.5 : 1.2
  const viewport = page.getViewport({ scale })

  // Canvas layer
  const canvas = container.querySelector('canvas') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  canvas.width = viewport.width
  canvas.height = viewport.height
  canvas.style.width = '100%'

  await page.render({ canvasContext: ctx, viewport, canvas }).promise

  // Text layer for selection
  const textLayerDiv = container.querySelector('.pdf-text-layer') as HTMLDivElement
  textLayerDiv.style.setProperty('--scale-factor', String(scale))
  const textContent = await page.getTextContent()

  // Use pdfjsLib text layer renderer
  const textLayer = new pdfjsLib.TextLayer({
    textContentSource: textContent,
    container: textLayerDiv,
    viewport,
  })
  await textLayer.render()
}

// ─── Scroll to page (called from parent via focusRef) ─────────────────────
function scrollToPage(n: number) {
  const hasPages = pageRefs.value.length > 0 && pageRefs.value.some(p => p !== null)
  if (loading.value || !hasPages) {
    pendingScrollPage.value = n
    return
  }
  const el = pageRefs.value[n - 1]
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    highlightedPage.value = n
    setTimeout(() => {
      if (highlightedPage.value === n) highlightedPage.value = null
    }, 3000)
  }
}

defineExpose({ scrollToPage })

// ─── Text selection tooltip ────────────────────────────────────────────────
function onMouseUp(e: MouseEvent, pageNum: number) {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) {
    tooltipVisible.value = false
    return
  }
  const text = sel.toString().trim()
  if (!text) {
    tooltipVisible.value = false
    return
  }
  tooltipPageNum.value = pageNum
  tooltipX.value = e.offsetX
  tooltipY.value = e.offsetY
  tooltipVisible.value = true
}

function onMouseDownOutside() {
  if (tooltipVisible.value) tooltipVisible.value = false
}

function addSelectionReference(pageNum: number) {
  const sel = window.getSelection()
  const text = sel?.toString().trim() ?? ''
  if (!text) return
  emit('add-reference', {
    refType: 'text-selection',
    pageNumber: pageNum,
    selectedText: text,
  })
  sel?.removeAllRanges()
  tooltipVisible.value = false
}

function addPageReference(pageNum: number) {
  emit('add-reference', { refType: 'pdf-page', pageNumber: pageNum })
}

// ─── Lifecycle ────────────────────────────────────────────────────────────
onMounted(() => {
  loadPdf()
  document.addEventListener('mousedown', onMouseDownOutside)
})

onUnmounted(() => {
  pdfDoc?.destroy()
  document.removeEventListener('mousedown', onMouseDownOutside)
})

watch(() => props.url, loadPdf)
</script>

<template>
  <div ref="containerRef" class="pdf-viewer">
    <!-- Loading -->
    <div v-if="loading" class="pdf-state">
      <div class="pdf-spinner" />
      <span>Loading PDF…</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="pdf-state pdf-state--error">
      <span>{{ error }}</span>
    </div>

    <!-- Pages -->
    <template v-else>
      <div
        v-for="n in numPages"
        :key="n"
        :ref="(el) => { pageRefs[n - 1] = el as HTMLDivElement }"
        :data-page="n"
        class="pdf-page"
        :class="{ 'pdf-page--highlighted': highlightedPage === n }"
      >
        <!-- Page toolbar -->
        <div class="pdf-page-toolbar">
          <span class="pdf-page-num">Page {{ n }}</span>
          <button
            class="pdf-ref-btn"
            :title="`Reference page ${n}`"
            @click.stop="addPageReference(n)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Reference page
          </button>
        </div>

        <!-- Canvas + text layer wrapper -->
        <div class="pdf-canvas-wrapper" @mouseup="onMouseUp($event, n)">
          <canvas class="pdf-canvas" />
          <div class="pdf-text-layer" />

          <!-- Selection tooltip -->
          <Transition name="tooltip-fade">
            <div
              v-if="tooltipVisible && tooltipPageNum === n"
              class="selection-tooltip"
              :style="{ left: `${tooltipX}px`, top: `${tooltipY - 38}px` }"
              @mousedown.stop
            >
              <button class="tooltip-btn" @click.stop="addSelectionReference(n)">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Add reference
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pdf-viewer {
  @apply flex flex-col gap-3 overflow-y-auto h-full px-2 py-2 flex-1;
}

/* ─── State ─────────────────────────────────────────────────────────────── */
.pdf-state {
  @apply flex flex-col items-center justify-center gap-3 py-10 text-sm text-surface-500;
}

.pdf-state--error {
  @apply text-red-500 text-xs px-4 text-center;
}

.pdf-spinner {
  @apply w-5 h-5 border-2 border-surface-300 border-t-accent-500 rounded-full animate-spin;
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
.pdf-page {
  @apply flex flex-col rounded-lg overflow-hidden w-full shrink-0
         border border-surface-200 dark:border-surface-300
         bg-white shadow-sm;
  min-height: 80px;
}

.pdf-page-toolbar {
  @apply flex items-center justify-between px-2 py-1
         bg-surface-100 dark:bg-surface-100
         border-b border-surface-200 dark:border-surface-200;
}

.pdf-page-num {
  @apply text-xs text-surface-500 font-mono;
}

.pdf-ref-btn {
  @apply flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium
         text-accent-600 dark:text-accent-400
         hover:bg-accent-500/10 transition-colors duration-100;
}

/* ─── Canvas ────────────────────────────────────────────────────────────── */
.pdf-canvas-wrapper {
  @apply relative select-text;
}

.pdf-canvas {
  @apply block w-full;
}

/* pdf.js text layer */
.pdf-text-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  line-height: 1;
}

:deep(.pdf-text-layer span) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
}

:deep(.pdf-text-layer .highlight) {
  background: rgba(92, 114, 243, 0.25);
  border-radius: 2px;
}

/* ─── Selection tooltip ─────────────────────────────────────────────────── */
.selection-tooltip {
  @apply absolute z-30 flex items-center;
  pointer-events: all;
}

.tooltip-btn {
  @apply flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
         bg-white dark:bg-surface-50
         text-surface-50 dark:text-surface-950
         shadow-lg border border-surface-800 dark:border-surface-300
         whitespace-nowrap;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

.pdf-page--highlighted {
  @apply ring-4 ring-accent-500 dark:ring-accent-400 border-accent-500 dark:border-accent-400;
  box-shadow: 0 10px 15px -3px rgba(92, 114, 243, 0.3), 0 4px 6px -2px rgba(92, 114, 243, 0.15);
}
</style>
