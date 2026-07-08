<script setup lang="ts">
</script>

<template>
  <div class="auth-layout">
    <!-- Background gradient blobs -->
    <div class="auth-blob auth-blob-1" aria-hidden="true" />
    <div class="auth-blob auth-blob-2" aria-hidden="true" />

    <div class="auth-container">
      <!-- Logo -->
      <div class="auth-logo">
        <svg class="auth-logo-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="currentColor" class="text-accent-500" />
          <circle cx="16" cy="16" r="6" stroke="white" stroke-width="1.5" fill="none" />
          <circle cx="16" cy="16" r="2.5" fill="white" />
          <path d="M16 10V12M16 20V22M10 16H12M20 16H22" stroke="white" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span class="auth-logo-text">ClassMonitor</span>
      </div>

      <!-- Card -->
      <div class="auth-card">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  @apply min-h-screen bg-surface-50 dark:bg-surface-0 flex items-center justify-center p-4 relative overflow-hidden;
}

.auth-blob {
  @apply absolute rounded-full blur-3xl opacity-20 pointer-events-none;
}

.auth-blob-1 {
  @apply w-96 h-96 bg-accent-500 -top-20 -right-20;
}

.auth-blob-2 {
  @apply w-80 h-80 bg-violet-500 -bottom-10 -left-20;
}

.auth-container {
  @apply w-full max-w-md z-10 flex flex-col items-center gap-8;
}

.auth-logo {
  @apply flex items-center gap-3;
}

.auth-logo-icon {
  @apply w-10 h-10;
}

.auth-logo-text {
  @apply text-2xl font-semibold text-surface-950 dark:text-surface-950 tracking-tight;
}

.auth-card {
  @apply w-full bg-white dark:bg-surface-100 rounded-2xl border border-surface-200 dark:border-surface-300 shadow-xl p-8;
}
</style>
