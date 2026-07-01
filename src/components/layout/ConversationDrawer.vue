<script setup lang="ts">
import { watch } from 'vue'
import Sidebar from '@/components/layout/Sidebar.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// Close on Escape key
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  }
)
</script>

<template>
  <Transition name="drawer">
    <div v-if="open" class="drawer-wrapper" role="dialog" aria-label="Conversations" aria-modal="true">
      <!-- Backdrop -->
      <div class="drawer-backdrop" aria-hidden="true" @click="emit('close')" />

      <!-- Panel -->
      <aside class="drawer-panel">
        <Sidebar @close="emit('close')" />
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-wrapper {
  @apply fixed inset-0 z-40 flex;
}

.drawer-backdrop {
  @apply absolute inset-0 bg-black/30 backdrop-blur-sm;
}

.drawer-panel {
  @apply relative z-10 flex flex-col h-full bg-surface-100 dark:bg-surface-50
         border-r border-surface-200 dark:border-surface-200 shadow-2xl;
  width: 260px;
}

/* Slide-in from left */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(-100%);
}
</style>
