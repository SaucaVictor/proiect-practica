<script setup lang="ts">
import { ref } from 'vue'
import AppRail from '@/components/layout/AppRail.vue'
import ConversationDrawer from '@/components/layout/ConversationDrawer.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'

const drawerOpen = ref(false)
const { isMobile } = useBreakpoint()

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value
}
</script>

<template>
  <div class="app-layout">
    <!-- Permanent icon rail (desktop only — hidden on mobile) -->
    <AppRail v-if="!isMobile" @toggle-chat-drawer="toggleDrawer" />

    <!-- Conversation drawer (slides in over content) -->
    <ConversationDrawer :open="drawerOpen" @close="drawerOpen = false" />

    <!-- Main content area -->
    <main class="app-main" :class="{ 'app-main--mobile': isMobile }">
      <slot :toggle-drawer="toggleDrawer" />
    </main>

    <!-- Mobile bottom tab bar -->
    <AppRail v-if="isMobile" mobile @toggle-chat-drawer="toggleDrawer" />

    <!-- Toast notifications -->
    <ToastContainer />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100%; /* dynamic relative height — allows shrinking when keyboard opens */
  width: 100vw;
  overflow: hidden;
  @apply bg-surface-50 dark:bg-surface-0;
}

.app-main {
  @apply flex-1 flex flex-col min-w-0 overflow-hidden;
}

/* On mobile, reserve space at the bottom for the fixed tab bar */
.app-main--mobile {
  padding-bottom: calc(58px + env(safe-area-inset-bottom, 0px));
}
</style>
