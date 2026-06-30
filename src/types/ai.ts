import type { Message } from './chat'

// ─── Provider ────────────────────────────────────────────────────────────────

export type ProviderName = 'nvidia' | 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter' | 'ollama'

export interface ProviderConfig {
  name: ProviderName
  displayName: string
  baseUrl: string
  apiKeyEnvName: string
  enabled: boolean
  supportsStreaming: boolean
  supportsVision: boolean
  supportsReasoning: boolean
}

// ─── Model ───────────────────────────────────────────────────────────────────

export interface AIModel {
  id: string
  name: string
  provider: ProviderName
  contextWindow: number
  maxOutputTokens: number
  supportsVision: boolean
  supportsReasoning: boolean
  supportsSystemPrompt: boolean
  description?: string
  tags?: string[]
}

// ─── Request / Response ──────────────────────────────────────────────────────

export interface AIRequestMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | AIContentPart[]
}

export interface AIContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string; detail?: 'low' | 'high' | 'auto' }
}

export interface AIRequest {
  provider: ProviderName
  model: string
  messages: AIRequestMessage[]
  systemPrompt?: string
  temperature?: number
  topP?: number
  topK?: number
  maxTokens?: number
  stopSequences?: string[]
  presencePenalty?: number
  frequencyPenalty?: number
  stream?: boolean
  conversationId?: string
}

export interface AIResponse {
  id: string
  model: string
  provider: ProviderName
  content: string
  reasoning?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error'
}

export interface StreamChunk {
  type: 'token' | 'reasoning' | 'done' | 'error'
  content?: string
  error?: string
  usage?: AIResponse['usage']
  finishReason?: AIResponse['finishReason']
}

// ─── Provider Interface ──────────────────────────────────────────────────────

export interface IProvider {
  readonly name: ProviderName
  readonly config: ProviderConfig

  /**
   * Send a non-streaming chat completion request.
   */
  chat(request: AIRequest): Promise<AIResponse>

  /**
   * Send a streaming chat completion request.
   * Calls callbacks as chunks arrive.
   */
  stream(
    request: AIRequest,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void>

  /**
   * Return list of available models from the provider.
   */
  listModels(): Promise<AIModel[]>

  /**
   * Validate that the configured API key works.
   */
  validateKey(): Promise<boolean>
}

export interface StreamCallbacks {
  onToken: (token: string) => void
  onReasoning?: (token: string) => void
  onComplete: (response: AIResponse) => void
  onError: (error: Error) => void
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export type MessagesToAIMessages = (messages: Message[]) => AIRequestMessage[]
