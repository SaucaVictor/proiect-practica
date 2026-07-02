import type {
  IProvider,
  ProviderConfig,
  ProviderName,
  AIRequest,
  AIResponse,
  AIModel,
  StreamCallbacks,
  AIRequestMessage,
} from '@/types'
import { NVIDIA_MODELS } from '../models'

const NVIDIA_BASE_URL = '/v1'

interface OpenAIMessage {
  role: string
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>
}

interface OpenAIStreamDelta {
  choices?: Array<{
    delta?: {
      content?: string
      reasoning_content?: string
    }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export class NvidiaProvider implements IProvider {
  readonly name: ProviderName = 'nvidia'

  readonly config: ProviderConfig = {
    name: 'nvidia',
    displayName: 'NVIDIA NIM',
    baseUrl: NVIDIA_BASE_URL,
    apiKeyEnvName: 'VITE_NVIDIA_API_KEY',
    enabled: true,
    supportsStreaming: true,
    supportsVision: true,
    supportsReasoning: true,
  }

  constructor(private readonly apiKey: string) {}

  // ─── chat (non-streaming) ───────────────────────────────────────────────────

  async chat(request: AIRequest): Promise<AIResponse> {
    const body = this.buildRequestBody(request, false)
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`NVIDIA API error ${response.status}: ${errorText}`)
    }

    const data = (await response.json()) as {
      id: string
      model: string
      choices: Array<{
        message: { content: string; reasoning_content?: string }
        finish_reason: string
      }>
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }

    return {
      id: data.id,
      model: data.model,
      provider: 'nvidia',
      content: data.choices[0]?.message.content ?? '',
      reasoning: data.choices[0]?.message.reasoning_content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      finishReason: (data.choices[0]?.finish_reason as AIResponse['finishReason']) ?? 'stop',
    }
  }

  // ─── stream ─────────────────────────────────────────────────────────────────

  async stream(
    request: AIRequest,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const body = this.buildRequestBody(request, true)

    let response: Response
    try {
      response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal,
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      callbacks.onError(err instanceof Error ? err : new Error(String(err)))
      return
    }

    if (!response.ok) {
      const errorText = await response.text()
      callbacks.onError(new Error(`NVIDIA API error ${response.status}: ${errorText}`))
      return
    }

    if (!response.body) {
      callbacks.onError(new Error('No response body'))
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let fullReasoning = ''
    let usage: AIResponse['usage'] | undefined

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (signal?.aborted) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break

          try {
            const chunk = JSON.parse(data) as OpenAIStreamDelta
            if (chunk.usage) {
              usage = {
                promptTokens: chunk.usage.prompt_tokens ?? 0,
                completionTokens: chunk.usage.completion_tokens ?? 0,
                totalTokens: chunk.usage.total_tokens ?? 0,
              }
            }
            const delta = chunk.choices?.[0]?.delta
            if (!delta) continue

            if (delta.reasoning_content) {
              fullReasoning += delta.reasoning_content
              callbacks.onReasoning?.(delta.reasoning_content)
            }
            if (delta.content) {
              fullContent += delta.content
              callbacks.onToken(delta.content)
            }
          } catch {
            // Malformed chunk — skip
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    callbacks.onComplete({
      id: crypto.randomUUID(),
      model: request.model,
      provider: 'nvidia',
      content: fullContent,
      reasoning: fullReasoning || undefined,
      usage,
      finishReason: 'stop',
    })
  }

  // ─── listModels ──────────────────────────────────────────────────────────────

  async listModels(): Promise<AIModel[]> {
    // NVIDIA NIM /models endpoint requires auth and may not list all NIM models
    // Return our curated list instead
    return NVIDIA_MODELS
  }

  // ─── validateKey ─────────────────────────────────────────────────────────────

  async validateKey(): Promise<boolean> {
    try {
      const response = await fetch(`${NVIDIA_BASE_URL}/models`, {
        headers: this.headers(),
      })
      return response.ok
    } catch {
      return false
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    }
  }

  private buildRequestBody(request: AIRequest, stream: boolean): Record<string, unknown> {
    const messages: OpenAIMessage[] = []

    // Prepend system prompt
    if (request.systemPrompt?.trim()) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }

    // Map conversation messages
    for (const msg of request.messages) {
      messages.push(this.mapMessage(msg))
    }

    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      stream,
      temperature: request.temperature ?? 0.7,
      top_p: request.topP ?? 1,
      max_tokens: request.maxTokens ?? 2048,
    }

    const isGemma = request.model.toLowerCase().includes('gemma')

    if (request.topK && request.topK > 0) {
      body.top_k = request.topK
    }
    if (!isGemma && request.presencePenalty !== undefined) {
      body.presence_penalty = request.presencePenalty
    }
    if (!isGemma && request.frequencyPenalty !== undefined) {
      body.frequency_penalty = request.frequencyPenalty
    }
    if (request.stopSequences?.length) {
      body.stop = request.stopSequences
    }
    if (stream && !isGemma) {
      body.stream_options = { include_usage: true }
    }

    return body
  }

  private mapMessage(msg: AIRequestMessage): OpenAIMessage {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content }
    }
    // Vision content parts
    return {
      role: msg.role,
      content: msg.content.map(part => {
        if (part.type === 'image_url' && part.image_url) {
          return { type: 'image_url', image_url: part.image_url }
        }
        return { type: 'text', text: part.text ?? '' }
      }),
    }
  }
}
