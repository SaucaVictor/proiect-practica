<script setup lang="ts">
import { ref, watch } from 'vue'
import { useReferencesStore } from '@/stores/references.store'
import UserResourcePanel from './UserResourcePanel.vue'
import CourseResourcePanel from './CourseResourcePanel.vue'

const emit = defineEmits<{
  'send-message': [content: string, metadata?: Record<string, any>]
}>()

const refStore = useReferencesStore()

// State
const topHeight = ref(50) // Default shares 50% height
const topMinimized = ref(false)
const bottomMinimized = ref(false)
const isDragging = ref(false)
const containerRef = ref<HTMLDivElement | null>(null)

// Drag resizing handlers
function startResize(e: MouseEvent) {
  e.preventDefault()
  isDragging.value = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

function handleResize(e: MouseEvent) {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const relativeY = e.clientY - rect.top
  let percent = (relativeY / rect.height) * 100

  // Keep a buffer of at least 15% on each side so they don't get accidentally crushed
  percent = Math.max(15, Math.min(85, percent))
  topHeight.value = percent
}

function stopResize() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

// Minimizing Toggles
function toggleTop() {
  topMinimized.value = !topMinimized.value
  if (topMinimized.value && bottomMinimized.value) {
    bottomMinimized.value = false // Keep at least one open
  }
}

function toggleBottom() {
  bottomMinimized.value = !bottomMinimized.value
  if (bottomMinimized.value && topMinimized.value) {
    topMinimized.value = false // Keep at least one open
  }
}

// Auto-expand correct panel if a reference is focused in ChatInput
watch(
  () => refStore.focusRef,
  (fr) => {
    if (!fr) return
    if (fr.isUserResource) {
      topMinimized.value = false
    } else {
      bottomMinimized.value = false
    }
  }
)
</script>

<template>
  <div 
    ref="containerRef" 
    class="resources-container" 
    :class="{ 'is-resizing': isDragging }"
  >
    <!-- TOP SECTION: Your Resources -->
    <div 
      class="panel-wrapper top-wrapper" 
      :style="{ 
        height: topMinimized 
          ? '41px' 
          : bottomMinimized 
            ? 'calc(100% - 41px)' 
            : `calc(${topHeight}% - 4px)` 
      }"
      :class="{ 'is-minimized': topMinimized }"
    >
      <UserResourcePanel 
        :is-minimized="topMinimized"
        @toggle-minimize="toggleTop"
        @send-message="(content, meta) => emit('send-message', content, meta)"
      />
    </div>

    <!-- RESIZE BAR -->
    <div 
      v-if="!topMinimized && !bottomMinimized"
      class="resize-bar" 
      :class="{ 'resize-bar--active': isDragging }"
      @mousedown="startResize"
      aria-hidden="true"
    >
      <div class="resize-handle-line" />
    </div>

    <!-- BOTTOM SECTION: Course Resources -->
    <div 
      class="panel-wrapper bottom-wrapper" 
      :style="{ 
        height: bottomMinimized 
          ? '41px' 
          : topMinimized 
            ? 'calc(100% - 41px)' 
            : `calc(${100 - topHeight}% - 4px)` 
      }"
      :class="{ 'is-minimized': bottomMinimized }"
    >
      <CourseResourcePanel 
        :is-minimized="bottomMinimized"
        @toggle-minimize="toggleBottom"
        @send-message="(content, meta) => emit('send-message', content, meta)"
      />
    </div>
  </div>
</template>

<style scoped>
.resources-container {
  @apply flex flex-col h-full w-full overflow-hidden select-none bg-surface-100 dark:bg-surface-50;
}

.resources-container.is-resizing {
  @apply cursor-row-resize;
}

.panel-wrapper {
  @apply w-full overflow-hidden transition-[height] duration-0 ease-in-out;
}

.panel-wrapper.is-minimized {
  @apply transition-[height] duration-200;
}

.resize-bar {
  @apply relative h-1 w-full cursor-row-resize z-20 flex items-center justify-center
         bg-surface-200 dark:bg-surface-300
         hover:bg-accent-400 dark:hover:bg-accent-400 transition-colors duration-150;
}

.resize-bar--active {
  @apply bg-accent-500 dark:bg-accent-400;
}

.resize-handle-line {
  @apply w-8 h-0.5 rounded-full bg-surface-800 opacity-60;
}
</style>
