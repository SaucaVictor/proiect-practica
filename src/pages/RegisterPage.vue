<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useThemeStore } from '@/stores/theme.store'
import { useProviderStore } from '@/stores/provider.store'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const themeStore = useThemeStore()
const providerStore = useProviderStore()

const displayName = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const errors = ref<Record<string, string>>({})

function validate(): boolean {
  errors.value = {}
  if (!displayName.value.trim())      errors.value['displayName'] = 'Name is required'
  if (!email.value.includes('@'))     errors.value['email']    = 'Enter a valid email'
  if (password.value.length < 6)     errors.value['password'] = 'Minimum 6 characters'
  if (password.value !== confirm.value) errors.value['confirm'] = 'Passwords do not match'
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return
  try {
    await authStore.register({
      email: email.value,
      password: password.value,
      displayName: displayName.value.trim(),
    })
    await settingsStore.load()
    themeStore.initialize()
    providerStore.initialize()
    await router.push({ name: 'chat' })
  } catch (err) {
    errors.value['general'] = (err as Error).message
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1 class="page-title">Create account</h1>
      <p class="page-subtitle">Start chatting with AI in seconds</p>
    </div>

    <form class="auth-form" novalidate @submit.prevent="submit">
      <div v-if="errors['general']" class="error-banner" role="alert">{{ errors['general'] }}</div>

      <Input
        id="register-name"
        v-model="displayName"
        label="Display name"
        placeholder="Your name"
        :error="errors['displayName']"
        required
        autocomplete="name"
      />

      <Input
        id="register-email"
        v-model="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        :error="errors['email']"
        required
        autocomplete="email"
      />

      <Input
        id="register-password"
        v-model="password"
        label="Password"
        type="password"
        placeholder="••••••••"
        :error="errors['password']"
        required
        autocomplete="new-password"
      />

      <Input
        id="register-confirm"
        v-model="confirm"
        label="Confirm password"
        type="password"
        placeholder="••••••••"
        :error="errors['confirm']"
        required
        autocomplete="new-password"
      />

      <Button id="register-submit" type="submit" full-width :loading="authStore.loading">
        Create account
      </Button>

      <p class="auth-switch">
        Already have an account?
        <router-link :to="{ name: 'login' }" class="auth-switch-link">Sign in</router-link>
      </p>
    </form>
  </div>
</template>

<style scoped>
.page-head  { @apply text-center mb-8; }
.page-title { @apply text-2xl font-bold text-surface-950 dark:text-surface-950; }
.page-subtitle { @apply text-sm text-surface-600 dark:text-surface-600 mt-1; }
.auth-form  { @apply flex flex-col gap-4; }
.error-banner { @apply p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm; }
.auth-switch  { @apply text-sm text-center text-surface-600 dark:text-surface-600; }
.auth-switch-link { @apply text-accent-400 hover:underline ml-1; }
</style>
