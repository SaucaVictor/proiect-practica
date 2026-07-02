<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { storeToRefs } from 'pinia'
import Avatar from '@/components/ui/Avatar.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

const emit = defineEmits<{
  'toggle-chat-drawer': []
}>()

const route = useRoute()
const authStore = useAuthStore()
const { user } = storeToRefs(authStore)

const activeRoute = computed(() => route.name as string)

function isActive(name: string | string[]) {
  if (Array.isArray(name)) return name.includes(activeRoute.value)
  return activeRoute.value === name
}
</script>

<template>
  <nav class="app-rail" aria-label="Main navigation">
    <!-- Logo -->
    <div class="rail-logo">
      <svg class="rail-logo-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="#5c72f3" />
        <circle cx="12" cy="12" r="4.5" stroke="white" stroke-width="1.2" fill="none" />
        <circle cx="12" cy="12" r="1.8" fill="white" />
      </svg>
    </div>

    <!-- Primary Nav -->
    <div class="rail-nav">
      <!-- Chat -->
      <button
        id="rail-chat-btn"
        class="rail-item"
        :class="{ 'rail-item--active': isActive(['chat', 'chat-conversation']) }"
        title="Chat"
        aria-label="Open conversations"
        @click="emit('toggle-chat-drawer')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span class="rail-label">Chat</span>
      </button>

      <!-- Audio -->
      <router-link
        id="rail-audio-link"
        :to="{ name: 'audio-call' }"
        class="rail-item"
        :class="{ 'rail-item--active': isActive('audio-call') }"
        title="Live Audio"
        aria-label="Live Audio"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </svg>
        <span class="rail-label">Audio</span>
      </router-link>

      <!-- IoT -->
      <router-link
        id="rail-iot-link"
        :to="{ name: 'iot' }"
        class="rail-item"
        :class="{ 'rail-item--active': isActive('iot') }"
        title="IoT Dashboard"
        aria-label="IoT Dashboard"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
        <span class="rail-label">IoT</span>
      </router-link>

      <!-- Schedule -->
      <router-link
        id="rail-schedule-link"
        :to="{ name: 'schedule' }"
        class="rail-item"
        :class="{ 'rail-item--active': isActive('schedule') }"
        title="Orar"
        aria-label="Orar"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span class="rail-label">Orar</span>
      </router-link>
    </div>

    <!-- Spacer -->
    <div class="rail-spacer" />

    <!-- Footer Nav -->
    <div class="rail-footer">
      <!-- Settings -->
      <router-link
        id="rail-settings-link"
        :to="{ name: 'settings' }"
        class="rail-item"
        :class="{ 'rail-item--active': isActive('settings') }"
        title="Settings"
        aria-label="Settings"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span class="rail-label">Settings</span>
      </router-link>

      <!-- Theme Toggle -->
      <div class="rail-item rail-theme" title="Toggle theme" aria-label="Toggle theme">
        <ThemeToggle compact />
      </div>

      <!-- Profile -->
      <router-link
        id="rail-profile-link"
        :to="{ name: 'profile' }"
        class="rail-item rail-profile"
        :class="{ 'rail-item--active': isActive('profile') }"
        :title="user?.displayName ?? 'Profile'"
        :aria-label="`Profile: ${user?.displayName}`"
      >
        <Avatar
          :name="user?.displayName ?? user?.email ?? 'User'"
          :src="user?.avatarUrl ?? undefined"
          size="sm"
        />
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.app-rail {
  @apply flex flex-col items-center flex-shrink-0 h-full
         bg-surface-100 dark:bg-surface-50
         border-r border-surface-200 dark:border-surface-200
         py-3 gap-1;
  width: 56px;
}

.rail-logo {
  @apply flex items-center justify-center mb-2;
}

.rail-logo-icon {
  @apply w-7 h-7;
}

.rail-nav {
  @apply flex flex-col items-center gap-1 w-full px-1.5;
}

.rail-footer {
  @apply flex flex-col items-center gap-1 w-full px-1.5;
}

.rail-spacer {
  @apply flex-1;
}

.rail-item {
  @apply relative flex flex-col items-center justify-center w-full
         rounded-lg py-2 px-1 gap-0.5 cursor-pointer
         text-surface-500 dark:text-surface-600
         hover:bg-surface-200 dark:hover:bg-surface-200
         hover:text-surface-950 dark:hover:text-surface-950
         transition-all duration-150;
  min-height: 44px;
  text-decoration: none;
  border: none;
  background: transparent;
}

.rail-item--active {
  @apply bg-accent-500/10 dark:bg-accent-500/15
         text-accent-600 dark:text-accent-400;
}

.rail-item--active::before {
  content: '';
  @apply absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5
         bg-accent-500 rounded-r-full;
}

.rail-label {
  @apply text-[9px] font-medium leading-none tracking-wide;
}

.rail-theme {
  @apply cursor-default;
}

.rail-profile {
  @apply mt-1;
}
</style>
