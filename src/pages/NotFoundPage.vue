<script setup lang="ts">
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
</script>

<template>
  <div class="not-found">
    <div class="not-found-content">
      <div class="not-found-code" aria-hidden="true">404</div>
      <h1 class="not-found-title">Page not found</h1>
      <p class="not-found-desc">The page you're looking for doesn't exist or has been moved.</p>
      <Button id="go-home-btn" variant="primary" @click="router.push({ name: 'chat' })">
        Go home
      </Button>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  @apply flex items-center justify-center min-h-screen
         bg-surface-50 dark:bg-surface-0;
}

.not-found-content {
  @apply flex flex-col items-center gap-4 text-center;
}

.not-found-code {
  @apply text-8xl font-bold text-surface-200 dark:text-surface-200 select-none;
}

.not-found-title {
  @apply text-2xl font-bold text-surface-950 dark:text-surface-950;
}

.not-found-desc {
  @apply text-surface-600 dark:text-surface-600 text-sm;
}
</style>
