import type { ProviderName } from './ai'

export type Theme = 'dark' | 'light' | 'system' | 'ocean' | 'forest'

export type AccentColor = 'indigo' | 'violet' | 'sky' | 'emerald' | 'rose' | 'amber'

export interface ModelConfig {
  temperature: number
  topP: number
  topK: number
  maxTokens: number
  presencePenalty: number
  frequencyPenalty: number
  streamEnabled: boolean
  stopSequences: string[]
}

export interface ThemeConfig {
  theme: Theme
  accentColor: AccentColor
  fontSize: 'sm' | 'md' | 'lg'
  compactMode: boolean
}

export interface UserSettings {
  userId: string
  theme: Theme
  accentColor: AccentColor
  fontSize: 'sm' | 'md' | 'lg'
  compactMode: boolean
  defaultProvider: ProviderName
  defaultModel: string
  systemPrompt: string
  temperature: number
  topP: number
  topK: number
  maxTokens: number
  presencePenalty: number
  frequencyPenalty: number
  streamEnabled: boolean
  sendOnEnter: boolean
  showTimestamps: boolean
  showTokenCount: boolean
  openResourcesOnNewChat: boolean
  updatedAt: string
}

export const DEFAULT_SETTINGS: Omit<UserSettings, 'userId' | 'updatedAt'> = {
  theme: 'dark',
  accentColor: 'indigo',
  fontSize: 'md',
  compactMode: false,
  defaultProvider: 'nvidia',
  defaultModel: 'minimaxai/minimax-m3',
  systemPrompt: '',
  temperature: 0.7,
  topP: 1,
  topK: 0,
  maxTokens: 2048,
  presencePenalty: 0,
  frequencyPenalty: 0,
  streamEnabled: true,
  sendOnEnter: true,
  showTimestamps: true,
  showTokenCount: false,
  openResourcesOnNewChat: false,
}
