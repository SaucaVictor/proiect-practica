<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import type { ToastMessage } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

function iconForType(type: ToastMessage['type']): string {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  }
  return icons[type]
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast" tag="div" class="toast-list">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast--${toast.type}`]"
          role="alert"
        >
          <span class="toast-icon" aria-hidden="true">{{ iconForType(toast.type) }}</span>
          <div class="toast-content">
            <p class="toast-title">{{ toast.title }}</p>
            <p v-if="toast.description" class="toast-desc">{{ toast.description }}</p>
          </div>
          <button
            class="toast-close"
            :aria-label="`Dismiss: ${toast.title}`"
            @click="dismiss(toast.id)"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  @apply fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none;
}

.toast-list { @apply flex flex-col gap-2; }

.toast {
  @apply flex items-start gap-3 p-4 rounded-xl shadow-lg
         bg-surface-100 dark:bg-surface-200
         border border-surface-200 dark:border-surface-300
         text-surface-950 dark:text-surface-950
         pointer-events-auto min-w-64 max-w-sm
         animate-fade-up;
}

.toast--success .toast-icon { @apply text-emerald-400; }
.toast--error   .toast-icon { @apply text-red-400; }
.toast--warning .toast-icon { @apply text-amber-400; }
.toast--info    .toast-icon { @apply text-accent-400; }

.toast-icon { @apply text-lg flex-shrink-0 font-bold; }

.toast-content { @apply flex-1 min-w-0; }
.toast-title   { @apply text-sm font-medium; }
.toast-desc    { @apply text-xs text-surface-700 dark:text-surface-700 mt-0.5; }

.toast-close {
  @apply text-surface-600 hover:text-surface-900 dark:hover:text-surface-950
         flex-shrink-0 text-xs leading-none;
}

/* Transitions */
.toast-enter-active  { @apply transition-all duration-300 ease-out; }
.toast-leave-active  { @apply transition-all duration-200 ease-in; }
.toast-enter-from    { @apply opacity-0 translate-y-2; }
.toast-leave-to      { @apply opacity-0 translate-x-4; }
</style>
