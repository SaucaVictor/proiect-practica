/**
 * OpenAI provider stub.
 * Implements IProvider so it can be registered without changes elsewhere.
 * Fill in the implementation when adding OpenAI support.
 */
import type {
  IProvider,
  ProviderConfig,
  ProviderName,
  AIRequest,
  AIResponse,
  AIModel,
  StreamCallbacks,
} from '@/types'

export class OpenAIProvider implements IProvider {
  readonly name: ProviderName = 'openai'

  readonly config: ProviderConfig = {
    name: 'openai',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnvName: 'VITE_OPENAI_API_KEY',
    enabled: false,
    supportsStreaming: true,
    supportsVision: true,
    supportsReasoning: true,
  }

  constructor(private readonly _apiKey: string) {}

  async chat(_request: AIRequest): Promise<AIResponse> {
    throw new Error('OpenAI provider not yet configured. Add VITE_OPENAI_API_KEY to .env')
  }

  async stream(_request: AIRequest, callbacks: StreamCallbacks, _signal?: AbortSignal): Promise<void> {
    callbacks.onError(new Error('OpenAI provider not yet configured. Add VITE_OPENAI_API_KEY to .env'))
  }

  async listModels(): Promise<AIModel[]> {
    return []
  }

  async validateKey(): Promise<boolean> {
    // No key set — not yet configured
    return !!this._apiKey && false
  }
}
