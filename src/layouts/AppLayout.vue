<script setup lang="ts">
import { ref } from 'vue'
import AppRail from '@/components/layout/AppRail.vue'
import ConversationDrawer from '@/components/layout/ConversationDrawer.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'

const drawerOpen = ref(false)

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value
}
</script>

<template>
  <div class="app-layout">
    <!-- Permanent icon rail -->
    <AppRail @toggle-chat-drawer="toggleDrawer" />

    <!-- Conversation drawer (slides in over content) -->
    <ConversationDrawer :open="drawerOpen" @close="drawerOpen = false" />

    <!-- Main content area -->
    <main class="app-main">
      <slot :toggle-drawer="toggleDrawer" />
    </main>

    <!-- Toast notifications -->
    <ToastContainer />
  </div>
</template>

<style scoped>
.app-layout {
  @apply flex h-screen w-screen overflow-hidden bg-surface-50 dark:bg-surface-0;
}

.app-main {
  @apply flex-1 flex flex-col min-w-0 overflow-hidden;
}
</style>
