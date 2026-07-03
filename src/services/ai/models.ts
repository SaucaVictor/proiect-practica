import type { AIModel, ProviderName } from '@/types'

export interface ModelMeta extends AIModel {
  provider: ProviderName
}

export const NVIDIA_MODELS: ModelMeta[] = [
  {
    id: 'minimaxai/minimax-m3',
    name: 'Minimax M3',
    provider: 'nvidia',
    contextWindow: 245760,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsReasoning: true,
    supportsSystemPrompt: true,
    description: 'Minimax\'s advanced Mixture-of-Experts multimodal model supporting vision, reasoning, and long context',
    tags: ['vision', 'reasoning', 'multimodal', 'popular'],
  },
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'nvidia',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsReasoning: false,
    supportsSystemPrompt: true,
    description: 'Meta\'s latest flagship model, offering state-of-the-art performance',
    tags: ['popular', 'powerful', 'flagship'],
  },
  {
    id: 'meta/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B Instruct',
    provider: 'nvidia',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsReasoning: false,
    supportsSystemPrompt: true,
    description: 'Meta\'s powerful open-source model, great for general tasks',
    tags: [],
  },
  {
    id: 'meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    provider: 'nvidia',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsReasoning: false,
    supportsSystemPrompt: true,
    description: 'Smaller, faster variant of Llama 3.1',
    tags: ['fast'],
  },
  {
    id: 'meta/llama-3.2-3b-instruct',
    name: 'Llama 3.2 3B Instruct',
    provider: 'nvidia',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsReasoning: false,
    supportsSystemPrompt: true,
    description: 'Highly efficient compact model for lightweight text tasks',
    tags: ['fast', 'efficient'],
  },
  {
    id: 'meta/llama-3.2-11b-vision-instruct',
    name: 'Llama 3.2 11B Vision',
    provider: 'nvidia',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsReasoning: false,
    supportsSystemPrompt: true,
    description: 'Multimodal model supporting image understanding',
    tags: ['vision', 'multimodal'],
  },
  {
    id: 'meta/llama-3.2-90b-vision-instruct',
    name: 'Llama 3.2 90B Vision',
    provider: 'nvidia',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsReasoning: false,
    supportsSystemPrompt: true,
    description: 'Large multimodal model for advanced image understanding',
    tags: ['vision', 'powerful'],
  },
  {
    id: 'google/gemma-2-2b-it',
    name: 'Gemma 2 2B',
    provider: 'nvidia',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsReasoning: false,
    supportsSystemPrompt: true,
    description: 'Google\'s extremely lightweight and efficient model',
    tags: ['google', 'efficient'],
  },
  {
    id: 'google/gemma-4-31b-it',
    name: 'Gemma 4 31B IT',
    provider: 'nvidia',
    contextWindow: 256000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsReasoning: true,
    supportsSystemPrompt: true,
    description: 'Google\'s advanced Gemma 4 model supporting reasoning, multimodal inputs, and 256k context window',
    tags: ['google', 'multimodal', 'reasoning', 'popular'],
  },
  {
    id: 'deepseek-ai/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    provider: 'nvidia',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsVision: false,
    supportsReasoning: true,
    supportsSystemPrompt: true,
    description: 'DeepSeek\'s flagship Mixture-of-Experts model, optimized for coding and complex reasoning',
    tags: ['coding', 'reasoning', 'popular'],
  },
  {
    id: 'deepseek-ai/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    provider: 'nvidia',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    supportsVision: false,
    supportsReasoning: true,
    supportsSystemPrompt: true,
    description: 'A high-speed variant of DeepSeek V4 optimized for rapid reasoning and a 1M token context window',
    tags: ['fast', 'reasoning'],
  },
  {
    id: 'nvidia/nemotron-nano-12b-v2-vl',
    name: 'Nemotron Nano VL 12B',
    provider: 'nvidia',
    contextWindow: 16384,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsReasoning: false,
    supportsSystemPrompt: true,
    description: 'NVIDIA\'s lightweight multimodal model for image and UI understanding',
    tags: ['vision', 'fast'],
  },
]

export const ALL_MODELS: ModelMeta[] = [...NVIDIA_MODELS]

export function getModelById(id: string): ModelMeta | undefined {
  return ALL_MODELS.find(m => m.id === id)
}

export function getModelsByProvider(provider: ProviderName): ModelMeta[] {
  return ALL_MODELS.filter(m => m.provider === provider)
}

export function getDefaultModel(): ModelMeta {
  return NVIDIA_MODELS[0]
}
