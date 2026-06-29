import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ProviderName, AIModel, ProviderConfig } from '@/types'
import { ProviderRegistry } from '@/services/ai/registry'
import { getModelsByProvider, getModelById } from '@/services/ai/models'
import { useSettingsStore } from './settings.store'

export const useProviderStore = defineStore('providers', () => {
  const settingsStore = useSettingsStore()

  // ─── State ──────────────────────────────────────────────────────────────────
  const activeProvider = ref<ProviderName>('nvidia')
  const activeModelId = ref<string>('meta/llama-3.1-70b-instruct')

  // ─── Getters ────────────────────────────────────────────────────────────────

  const providers = computed<ProviderConfig[]>(() => ProviderRegistry.getConfigs())

  const modelsForProvider = computed<AIModel[]>(() =>
    getModelsByProvider(activeProvider.value)
  )

  const activeModel = computed<AIModel | undefined>(() =>
    getModelById(activeModelId.value)
  )

  const activeProviderConfig = computed<ProviderConfig | undefined>(() =>
    providers.value.find(p => p.name === activeProvider.value)
  )

  // ─── Actions ─────────────────────────────────────────────────────────────────

  function setProvider(provider: ProviderName): void {
    activeProvider.value = provider
    // Auto-select first model from new provider
    const models = getModelsByProvider(provider)
    if (models.length > 0) {
      activeModelId.value = models[0].id
    }
  }

  function setModel(modelId: string): void {
    activeModelId.value = modelId
  }

  function initialize(): void {
    // If the user is currently viewing a conversation, do not overwrite the active model/provider with defaults
    const path = window.location.pathname
    const hasConversationId = /\/chat\/[0-9a-fA-F-]{36}/.test(path)
    if (hasConversationId) {
      return
    }

    const settings = settingsStore.current
    activeProvider.value = settings.defaultProvider
    const model = getModelById(settings.defaultModel)
    if (model) {
      activeModelId.value = settings.defaultModel
    } else {
      activeModelId.value = getModelsByProvider(settings.defaultProvider)[0]?.id || 'meta/llama-3.3-70b-instruct'
    }
  }

  return {
    activeProvider,
    activeModelId,
    providers,
    modelsForProvider,
    activeModel,
    activeProviderConfig,
    setProvider,
    setModel,
    initialize,
  }
})
