<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { useToast } from '@/composables/useToast'

const authStore = useAuthStore()
const { success, error: toastError } = useToast()

const email = ref('')
const sent = ref(false)
const errors = ref<{ email?: string }>({})

async function submit() {
  errors.value = {}
  if (!email.value.includes('@')) {
    errors.value.email = 'Enter a valid email'
    return
  }
  try {
    await authStore.sendPasswordReset(email.value)
    sent.value = true
    success('Reset email sent', 'Check your inbox')
  } catch (err) {
    toastError('Failed to send reset email', (err as Error).message)
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1 class="page-title">Reset password</h1>
      <p class="page-subtitle">We'll send a reset link to your email</p>
    </div>

    <div v-if="sent" class="sent-banner" role="status">
      ✓ Check your inbox for a reset link.
    </div>

    <form v-else class="auth-form" novalidate @submit.prevent="submit">
      <Input
        id="reset-email"
        v-model="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        :error="errors.email"
        required
        autocomplete="email"
      />

      <Button id="reset-submit" type="submit" full-width :loading="authStore.loading">
        Send reset link
      </Button>

      <p class="auth-switch">
        <router-link :to="{ name: 'login' }" class="auth-switch-link">← Back to sign in</router-link>
      </p>
    </form>
  </div>
</template>

<style scoped>
.page-head  { @apply text-center mb-8; }
.page-title { @apply text-2xl font-bold text-surface-950 dark:text-surface-950; }
.page-subtitle { @apply text-sm text-surface-600 dark:text-surface-600 mt-1; }
.auth-form  { @apply flex flex-col gap-4; }
.sent-banner { @apply p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm text-center; }
.auth-switch { @apply text-sm text-center; }
.auth-switch-link { @apply text-accent-400 hover:underline; }
</style>
