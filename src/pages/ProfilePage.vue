<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth.store'
import { updateProfile } from '@/services/supabase/auth'
import Avatar from '@/components/ui/Avatar.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { useToast } from '@/composables/useToast'

import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const { user } = storeToRefs(authStore)
const { success, error: toastError } = useToast()
const router = useRouter()

const displayName = ref(user.value?.displayName ?? '')
const saving = ref(false)

async function save() {
  saving.value = true
  try {
    await updateProfile({ displayName: displayName.value })
    if (user.value) {
      authStore.setUser({ ...user.value, displayName: displayName.value })
    }
    success('Profile updated')
  } catch (err) {
    toastError('Failed to update profile', (err as Error).message)
  } finally {
    saving.value = false
  }
}

async function logout() {
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="profile-page">
    <div class="profile-container">
      <h1 class="profile-title">Profile</h1>

      <div class="profile-card">
        <div class="profile-avatar-section">
          <Avatar :name="user?.displayName ?? user?.email" :src="user?.avatarUrl ?? undefined" size="xl" />
          <div>
            <p class="profile-name">{{ user?.displayName ?? 'User' }}</p>
            <p class="profile-email">{{ user?.email }}</p>
          </div>
        </div>

        <div class="profile-fields">
          <Input
            id="profile-name"
            v-model="displayName"
            label="Display name"
            placeholder="Your name"
          />

          <Input
            id="profile-email"
            :model-value="user?.email ?? ''"
            label="Email"
            type="email"
            disabled
            hint="Email cannot be changed"
          />
        </div>

        <div class="profile-actions">
          <Button id="save-profile-btn" variant="primary" :loading="saving" @click="save">
            Save changes
          </Button>
          <Button id="logout-btn" variant="danger" @click="logout">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page { @apply flex-1 overflow-y-auto; }
.profile-container { @apply max-w-lg mx-auto px-6 py-10 flex flex-col gap-6; }
.profile-title { @apply text-2xl font-bold text-surface-950 dark:text-surface-950; }

.profile-card {
  @apply bg-surface-100 dark:bg-surface-100 rounded-2xl
         border border-surface-200 dark:border-surface-200 p-6 flex flex-col gap-6;
}

.profile-avatar-section {
  @apply flex items-center gap-4;
}

.profile-name  { @apply text-lg font-semibold text-surface-950 dark:text-surface-950; }
.profile-email { @apply text-sm text-surface-600 dark:text-surface-600; }

.profile-fields  { @apply flex flex-col gap-4; }
.profile-actions { @apply flex items-center gap-3; }
</style>
