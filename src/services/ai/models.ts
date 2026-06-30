import type { AIModel, ProviderName } from '@/types'

export interface ModelMeta extends AIModel {
  provider: ProviderName
}

export const NVIDIA_MODELS: ModelMeta[] = [
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
    id: 'z-ai/glm-5.1',
    name: 'GLM 5.1',
    provider: 'nvidia',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsReasoning: true,
    supportsSystemPrompt: true,
    description: 'Z.ai\'s flagship MoE model, optimized for coding and complex reasoning',
    tags: ['coding', 'reasoning', 'popular'],
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
