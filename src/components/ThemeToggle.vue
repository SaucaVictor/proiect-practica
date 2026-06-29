<script setup lang="ts">
import { useThemeStore } from '@/stores/theme.store'
import { storeToRefs } from 'pinia'

const themeStore = useThemeStore()
const { isDark } = storeToRefs(themeStore)

function toggle() {
  themeStore.setTheme(isDark.value ? 'light' : 'dark')
}
</script>

<template>
  <button
    id="theme-toggle"
    class="theme-toggle"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="isDark ? 'Light mode' : 'Dark mode'"
    @click="toggle"
  >
    <!-- Sun icon -->
    <svg v-if="isDark" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.3" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1 1M11.8 11.8l1 1M11.8 3.2l1-1M3.2 11.8l1-1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
    <!-- Moon icon -->
    <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M14 9A6 6 0 0 1 7 2a6 6 0 1 0 7 7Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  @apply flex items-center justify-center w-8 h-8 rounded-lg
         text-surface-600 dark:text-surface-700
         hover:bg-surface-200 dark:hover:bg-surface-200
         hover:text-surface-950 dark:hover:text-surface-950
         transition-colors duration-150;
}
</style>
