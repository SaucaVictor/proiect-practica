<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useThemeStore } from '@/stores/theme.store'
import { useProviderStore } from '@/stores/provider.store'
import { onAuthStateChange } from '@/services/supabase/auth'
import AppLayout from '@/layouts/AppLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const themeStore = useThemeStore()
const providerStore = useProviderStore()

const layout = computed(() => (route.meta['layout'] as string | undefined) ?? 'app')

onMounted(async () => {
  // Initialize auth state
  await authStore.initialize()

  // Load user settings and initialize theme
  if (authStore.isAuthenticated) {
    await settingsStore.load()
    themeStore.initialize()
    providerStore.initialize()
  } else {
    themeStore.initialize()
  }

  // Listen for auth state changes (e.g., from another tab)
  onAuthStateChange((user) => {
    authStore.setUser(user)
    if (user) {
      void settingsStore.load().then(() => {
        themeStore.initialize()
        providerStore.initialize()
      })
    } else {
      if (route.meta.layout !== 'auth') {
        router.push({ name: 'login' })
      }
    }
  })
})
</script>

<template>
  <AuthLayout v-if="layout === 'auth'">
    <RouterView />
  </AuthLayout>

  <AppLayout v-else-if="layout === 'app'">
    <RouterView />
  </AppLayout>

  <RouterView v-else />
</template>
