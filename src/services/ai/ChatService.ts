import type { AIRequest, AIResponse, StreamCallbacks, ProviderName } from '@/types'
import { ProviderRegistry } from './registry'

/**
 * High-level service for sending chat messages.
 * All components should use this — never call providers directly.
 */
export class ChatService {
  /**
   * Send a non-streaming message.
   */
  static async send(request: AIRequest): Promise<AIResponse> {
    const provider = ProviderRegistry.get(request.provider)
    return provider.chat(request)
  }

  /**
   * Send a streaming message.
   * Returns an AbortController so the caller can cancel the stream.
   */
  static stream(
    request: AIRequest,
    callbacks: StreamCallbacks
  ): AbortController {
    const controller = new AbortController()
    const provider = ProviderRegistry.get(request.provider)

    provider
      .stream({ ...request, stream: true }, callbacks, controller.signal)
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          callbacks.onError(err instanceof Error ? err : new Error(String(err)))
        }
      })

    return controller
  }

  /**
   * Check if a provider is available (registered + has a key).
   */
  static isAvailable(provider: ProviderName): boolean {
    return ProviderRegistry.has(provider)
  }
}
