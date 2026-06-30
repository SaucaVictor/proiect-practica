<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  name?: string
  src?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  alt?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const initials = computed(() => {
  if (!props.name) return '?'
  return props.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const colorClass = computed(() => {
  if (!props.name) return 'bg-surface-400'
  const colors = [
    'bg-accent-500', 'bg-violet-500', 'bg-sky-500',
    'bg-emerald-500', 'bg-rose-500', 'bg-amber-500',
  ]
  let hash = 0
  for (const char of props.name) hash = char.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
})
</script>

<template>
  <div :class="['avatar', `avatar--${size}`]" :aria-label="alt ?? name">
    <img v-if="src" :src="src" :alt="alt ?? name" class="avatar-img" />
    <span v-else :class="['avatar-initials', colorClass]">{{ initials }}</span>
  </div>
</template>

<style scoped>
.avatar {
  @apply relative flex-shrink-0 rounded-full overflow-hidden;
}
.avatar--xs { @apply w-6 h-6 text-xs; }
.avatar--sm { @apply w-8 h-8 text-xs; }
.avatar--md { @apply w-9 h-9 text-sm; }
.avatar--lg { @apply w-12 h-12 text-base; }
.avatar--xl { @apply w-16 h-16 text-lg; }

.avatar-img      { @apply w-full h-full object-cover; }
.avatar-initials { @apply flex items-center justify-center w-full h-full text-white font-semibold; }
</style>
