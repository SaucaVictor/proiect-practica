import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserSettings } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'
import * as settingsService from '@/services/supabase/settings'

export const useSettingsStore = defineStore('settings', () => {
  // ─── State ──────────────────────────────────────────────────────────────────
  const settings = ref<UserSettings | null>(null)
  const loading = ref(false)
  const saving = ref(false)

  // ─── Getters ────────────────────────────────────────────────────────────────
  const current = computed(() => settings.value ?? { ...DEFAULT_SETTINGS, userId: '', updatedAt: '' })
  const streamEnabled = computed(() => current.value.streamEnabled)
  const sendOnEnter = computed(() => current.value.sendOnEnter)

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function load(): Promise<void> {
    loading.value = true
    try {
      settings.value = await settingsService.getSettings()
    } finally {
      loading.value = false
    }
  }

  async function save(updates: Partial<Omit<UserSettings, 'userId' | 'updatedAt'>>): Promise<void> {
    saving.value = true
    try {
      await settingsService.saveSettings(updates)
      if (settings.value) {
        settings.value = { ...settings.value, ...updates, updatedAt: new Date().toISOString() }
      }
    } finally {
      saving.value = false
    }
  }

  function setLocal(updates: Partial<Omit<UserSettings, 'userId' | 'updatedAt'>>): void {
    if (settings.value) {
      settings.value = { ...settings.value, ...updates }
    }
  }

  function initWithDefaults(userId: string): void {
    settings.value = settingsService.getDefaultSettings(userId)
  }

  return {
    settings,
    loading,
    saving,
    current,
    streamEnabled,
    sendOnEnter,
    load,
    save,
    setLocal,
    initWithDefaults,
  }
})
