<script setup lang="ts">
</script>

<template>
  <div class="typing-indicator" aria-label="AI is responding" role="status">
    <span class="dot" style="animation-delay: 0ms" />
    <span class="dot" style="animation-delay: 200ms" />
    <span class="dot" style="animation-delay: 400ms" />
  </div>
</template>

<style scoped>
.typing-indicator {
  @apply flex items-center gap-1.5 h-5;
}

.dot {
  @apply w-2 h-2 rounded-full bg-accent-400 animate-pulse-dot;
}
</style>
