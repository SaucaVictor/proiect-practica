<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'

const sidebarOpen = ref(true)
const mobileSidebarOpen = ref(false)

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function toggleMobileSidebar() {
  mobileSidebarOpen.value = !mobileSidebarOpen.value
}
</script>

<template>
  <div class="app-layout">
    <!-- Mobile sidebar overlay -->
    <Transition name="fade">
      <div
        v-if="mobileSidebarOpen"
        class="mobile-overlay"
        aria-hidden="true"
        @click="mobileSidebarOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <Transition name="slide-sidebar">
      <Sidebar
        :class="['app-sidebar', { 'app-sidebar--collapsed': !sidebarOpen }]"
        @close="mobileSidebarOpen = false"
      />
    </Transition>

    <!-- Main -->
    <main class="app-main">
      <slot :toggle-sidebar="toggleSidebar" :toggle-mobile-sidebar="toggleMobileSidebar" />
    </main>

    <!-- Toast notifications -->
    <ToastContainer />
  </div>
</template>

<style scoped>
.app-layout {
  @apply flex h-screen w-screen overflow-hidden bg-surface-50 dark:bg-surface-0;
}

.mobile-overlay {
  @apply fixed inset-0 bg-black/50 z-20 lg:hidden;
}

.app-sidebar {
  @apply flex-shrink-0 w-64 transition-all duration-300 ease-in-out;
}

.app-sidebar--collapsed {
  @apply w-0 overflow-hidden;
}

.app-main {
  @apply flex-1 flex flex-col min-w-0 overflow-hidden;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
