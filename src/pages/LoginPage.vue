<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useThemeStore } from '@/stores/theme.store'
import { useProviderStore } from '@/stores/provider.store'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const themeStore = useThemeStore()
const providerStore = useProviderStore()
const { success: _success } = useToast()

const email = ref('')
const password = ref('')
const errors = ref<{ email?: string; password?: string; general?: string }>({})

function validate(): boolean {
  errors.value = {}
  if (!email.value.includes('@')) errors.value.email = 'Enter a valid email'
  if (password.value.length < 6)  errors.value.password = 'Password must be at least 6 characters'
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return
  try {
    await authStore.login({ email: email.value, password: password.value })
    await settingsStore.load()
    themeStore.initialize()
    providerStore.initialize()
    const redirect = (route.query['redirect'] as string) ?? '/'
    await router.push(redirect)
  } catch (err) {
    errors.value.general = (err as Error).message
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1 class="page-title">Welcome back</h1>
      <p class="page-subtitle">Sign in to continue</p>
    </div>

    <form class="auth-form" novalidate @submit.prevent="submit">
      <div v-if="errors.general" class="error-banner" role="alert">
        {{ errors.general }}
      </div>

      <Input
        id="login-email"
        v-model="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        :error="errors.email"
        required
        autocomplete="email"
      />

      <Input
        id="login-password"
        v-model="password"
        label="Password"
        type="password"
        placeholder="••••••••"
        :error="errors.password"
        required
        autocomplete="current-password"
      />

      <div class="auth-form-footer">
        <router-link :to="{ name: 'forgot-password' }" class="forgot-link">
          Forgot password?
        </router-link>
      </div>

      <Button
        id="login-submit"
        type="submit"
        full-width
        :loading="authStore.loading"
      >
        Sign in
      </Button>

      <p class="auth-switch">
        Don't have an account?
        <router-link :to="{ name: 'register' }" class="auth-switch-link">Create one</router-link>
      </p>
    </form>
  </div>
</template>

<style scoped>
.page-head  { @apply text-center mb-8; }
.page-title { @apply text-2xl font-bold text-surface-950 dark:text-surface-950; }
.page-subtitle { @apply text-sm text-surface-600 dark:text-surface-600 mt-1; }

.auth-form { @apply flex flex-col gap-4; }

.error-banner {
  @apply p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm;
}

.auth-form-footer { @apply flex justify-end; }

.forgot-link {
  @apply text-xs text-accent-400 hover:underline;
}

.auth-switch      { @apply text-sm text-center text-surface-600 dark:text-surface-600; }
.auth-switch-link { @apply text-accent-400 hover:underline ml-1; }
</style>
