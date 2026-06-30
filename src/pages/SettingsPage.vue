<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '@/stores/settings.store'
import { useThemeStore } from '@/stores/theme.store'
import Toggle from '@/components/ui/Toggle.vue'
import Slider from '@/components/ui/Slider.vue'
import Button from '@/components/ui/Button.vue'
import { useToast } from '@/composables/useToast'

const settingsStore = useSettingsStore()
const themeStore = useThemeStore()
const { success } = useToast()

const { current: settings, saving } = storeToRefs(settingsStore)

async function save(updates: Parameters<typeof settingsStore.save>[0]) {
  await settingsStore.save(updates)
  success('Settings saved')
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-container">
      <h1 class="settings-title">Settings</h1>

      <!-- Appearance -->
      <section class="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" class="section-heading">Appearance</h2>
        <div class="section-body">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Theme</span>
            </div>
            <div class="theme-buttons">
              <button
                v-for="t in ['dark', 'light', 'system']"
                :key="t"
                :class="['theme-btn', { 'theme-btn--active': settings.theme === t }]"
                @click="themeStore.setTheme(t as 'dark' | 'light' | 'system')"
              >
                {{ t.charAt(0).toUpperCase() + t.slice(1) }}
              </button>
            </div>
          </div>
          <Toggle
            :model-value="settings.compactMode"
            label="Compact mode"
            description="Reduce spacing between messages"
            @update:model-value="save({ compactMode: $event })"
          />
          <Toggle
            :model-value="settings.showTimestamps"
            label="Show timestamps"
            @update:model-value="save({ showTimestamps: $event })"
          />
        </div>
      </section>

      <!-- Model defaults -->
      <section class="settings-section" aria-labelledby="model-heading">
        <h2 id="model-heading" class="section-heading">Model defaults</h2>
        <div class="section-body">
          <Slider
            :model-value="settings.temperature"
            label="Temperature"
            :min="0"
            :max="2"
            :step="0.01"
            @update:model-value="settingsStore.setLocal({ temperature: $event })"
          />
          <Slider
            :model-value="settings.topP"
            label="Top P"
            :min="0"
            :max="1"
            :step="0.01"
            @update:model-value="settingsStore.setLocal({ topP: $event })"
          />
          <Slider
            :model-value="settings.maxTokens"
            label="Max tokens"
            :min="256"
            :max="8192"
            :step="256"
            @update:model-value="settingsStore.setLocal({ maxTokens: $event })"
          />
          <Slider
            :model-value="settings.presencePenalty"
            label="Presence penalty"
            :min="-2"
            :max="2"
            :step="0.01"
            @update:model-value="settingsStore.setLocal({ presencePenalty: $event })"
          />
          <Slider
            :model-value="settings.frequencyPenalty"
            label="Frequency penalty"
            :min="-2"
            :max="2"
            :step="0.01"
            @update:model-value="settingsStore.setLocal({ frequencyPenalty: $event })"
          />
          <Button variant="primary" size="sm" :loading="saving" @click="save({ temperature: settings.temperature, topP: settings.topP, maxTokens: settings.maxTokens, presencePenalty: settings.presencePenalty, frequencyPenalty: settings.frequencyPenalty })">
            Save model settings
          </Button>
        </div>
      </section>

      <!-- Chat behaviour -->
      <section class="settings-section" aria-labelledby="chat-heading">
        <h2 id="chat-heading" class="section-heading">Chat behaviour</h2>
        <div class="section-body">
          <Toggle
            :model-value="settings.streamEnabled"
            label="Enable streaming"
            description="Show AI responses as they are generated"
            @update:model-value="save({ streamEnabled: $event })"
          />
          <Toggle
            :model-value="settings.sendOnEnter"
            label="Send on Enter"
            description="Shift+Enter for newline when enabled"
            @update:model-value="save({ sendOnEnter: $event })"
          />
          <Toggle
            :model-value="settings.showTokenCount"
            label="Show token count"
            @update:model-value="save({ showTokenCount: $event })"
          />
        </div>
      </section>

      <!-- System prompt -->
      <section class="settings-section" aria-labelledby="prompt-heading">
        <h2 id="prompt-heading" class="section-heading">System prompt</h2>
        <div class="section-body">
          <textarea
            id="system-prompt"
            :value="settings.systemPrompt"
            class="system-prompt-input"
            placeholder="You are a helpful AI assistant…"
            rows="5"
            aria-label="System prompt"
            @input="settingsStore.setLocal({ systemPrompt: ($event.target as HTMLTextAreaElement).value })"
          />
          <Button variant="primary" size="sm" :loading="saving" @click="save({ systemPrompt: settings.systemPrompt })">
            Save system prompt
          </Button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-page { @apply flex-1 overflow-y-auto; }

.settings-container {
  @apply max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8;
}

.settings-title {
  @apply text-2xl font-bold text-surface-950 dark:text-surface-950;
}

.settings-section {
  @apply flex flex-col gap-4;
}

.section-heading {
  @apply text-sm font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-600;
}

.section-body {
  @apply flex flex-col gap-5 bg-surface-100 dark:bg-surface-100
         rounded-2xl p-5 border border-surface-200 dark:border-surface-200;
}

.setting-row {
  @apply flex items-center justify-between;
}

.setting-label {
  @apply text-sm font-medium text-surface-900 dark:text-surface-950;
}

.theme-buttons {
  @apply flex rounded-lg overflow-hidden border border-surface-300 dark:border-surface-300;
}

.theme-btn {
  @apply px-3 py-1.5 text-sm text-surface-700 dark:text-surface-700
         transition-colors duration-100;
}

.theme-btn--active {
  @apply bg-accent-500 text-white;
}

.system-prompt-input {
  @apply w-full p-3 rounded-xl resize-none text-sm
         bg-surface-200 dark:bg-surface-200
         border border-surface-300 dark:border-surface-300
         text-surface-950 dark:text-surface-950
         placeholder:text-surface-600
         focus:outline-none focus:ring-1 focus:ring-accent-500;
}
</style>
