import type {
  IProvider,
  ProviderConfig,
  ProviderName,
  AIRequest,
  AIResponse,
  AIModel,
  StreamCallbacks,
} from '@/types'
import { NvidiaProvider } from './providers/nvidia'

class ProviderRegistryClass {
  private readonly providers = new Map<ProviderName, IProvider>()

  register(provider: IProvider): void {
    this.providers.set(provider.name, provider)
  }

  get(name: ProviderName): IProvider {
    const provider = this.providers.get(name)
    if (!provider) {
      throw new Error(`Provider "${name}" is not registered`)
    }
    return provider
  }

  has(name: ProviderName): boolean {
    return this.providers.has(name)
  }

  list(): IProvider[] {
    return Array.from(this.providers.values())
  }

  getConfigs(): ProviderConfig[] {
    return this.list().map(p => p.config)
  }
}

// Singleton
export const ProviderRegistry = new ProviderRegistryClass()

// Register built-in providers on module load
const nvidiaApiKey = import.meta.env.VITE_NVIDIA_API_KEY ?? ''
if (nvidiaApiKey) {
  ProviderRegistry.register(new NvidiaProvider(nvidiaApiKey))
}

export type { IProvider, AIRequest, AIResponse, AIModel, StreamCallbacks, ProviderConfig }
