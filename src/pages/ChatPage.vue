<script setup lang="ts">
import { watch, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat.store'
import { useConversationStore } from '@/stores/conversation.store'
import { useProviderStore } from '@/stores/provider.store'
import { useChat } from '@/composables/useChat'
import { useKeyboard } from '@/composables/useKeyboard'
import ChatMessages from '@/components/chat/ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ModelSelector from '@/components/model/ModelSelector.vue'
import Button from '@/components/ui/Button.vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { subscribeToMessages, unsubscribe } from '@/services/supabase/realtime'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const conversationStore = useConversationStore()
const providerStore = useProviderStore()
const { sendMessage, regenerate, abort } = useChat()

const { isStreaming } = storeToRefs(chatStore)

let realtimeChannel: RealtimeChannel | null = null

function conversationId(): string | undefined {
  const id = route.params['id']
  return typeof id === 'string' ? id : undefined
}

async function loadConversation(id: string) {
  if (realtimeChannel) {
    unsubscribe(realtimeChannel)
    realtimeChannel = null
  }

  await chatStore.loadConversation(id)

  // Subscribe to realtime message updates for this conversation
  realtimeChannel = subscribeToMessages(id, {
    onUpdate: (msg) => {
      if (msg.id) chatStore.updateMessage(msg.id, msg)
    },
  })
}

onMounted(async () => {
  const id = conversationId()
  if (id) await loadConversation(id)
})

watch(() => route.params['id'], async (id) => {
  if (typeof id === 'string') {
    await loadConversation(id)
  } else {
    chatStore.clearConversation()
  }
})

onUnmounted(() => {
  if (realtimeChannel) unsubscribe(realtimeChannel)
})

async function handleSend(content: string, attachments?: any[]) {
  let id = conversationId()

  // Create conversation if not exists
  if (!id) {
    const conv = await conversationStore.create({
      model: providerStore.activeModelId,
      provider: providerStore.activeProvider,
    })
    id = conv.id
    await router.push({ name: 'chat-conversation', params: { id } })
    await chatStore.loadConversation(id)
  }

  await sendMessage(content, id, attachments)
}

async function handleRegenerate() {
  const id = conversationId()
  if (id) await regenerate(id)
}

// Keyboard: Ctrl+Shift+O = new chat
useKeyboard([
  {
    combo: 'ctrl+shift+o',
    handler: async () => {
      await router.push({ name: 'chat' })
    },
    prevent: true,
  },
])

const conv = computed(() => {
  const id = conversationId()
  return id ? conversationStore.getById(id) : null
})

watch(conv, (newConv) => {
  if (newConv) {
    if (newConv.provider && newConv.provider !== providerStore.activeProvider) {
      providerStore.setProvider(newConv.provider as any)
    }
    if (newConv.model && newConv.model !== providerStore.activeModelId) {
      providerStore.setModel(newConv.model)
    }
  } else {
    // Only reset to default if we are explicitly on the "new chat" route
    if (!conversationId()) {
      providerStore.initialize()
    }
  }
}, { immediate: true })

watch(
  [() => providerStore.activeModelId, () => providerStore.activeProvider],
  async ([newModel, newProvider]) => {
    const id = conversationId()
    if (id && conv.value) {
      const modelChanged = conv.value.model !== newModel
      const providerChanged = conv.value.provider !== newProvider

      if (modelChanged || providerChanged) {
        try {
          await conversationStore.update(id, {
            model: newModel,
            provider: newProvider as any,
          })
        } catch (err) {
          console.error('Failed to update conversation settings', err)
        }
      }
    }
  }
)
</script>

<template>
  <div class="chat-page">
    <!-- Top bar -->
    <div class="chat-topbar">
      <div class="chat-topbar-left">
        <span v-if="conv" class="chat-conv-title">{{ conv.title }}</span>
        <span v-else class="chat-conv-title text-surface-600 dark:text-surface-600">New conversation</span>
      </div>
      <div class="chat-topbar-center">
        <ModelSelector />
      </div>
      <div class="chat-topbar-right">
        <Button
          v-if="isStreaming"
          id="header-abort-btn"
          variant="ghost"
          size="sm"
          aria-label="Stop generation"
          @click="abort"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
          </svg>
          Stop
        </Button>
        <Button
          v-else-if="chatStore.messages.length > 0"
          id="regenerate-btn"
          variant="ghost"
          size="sm"
          aria-label="Regenerate response"
          @click="handleRegenerate"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M2 6.5a4.5 4.5 0 0 1 8-2.83M11 6.5a4.5 4.5 0 0 1-8 2.83" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            <path d="M10 3.5V2h1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
          Regenerate
        </Button>
      </div>
    </div>

    <!-- Messages -->
    <ChatMessages class="chat-messages" />

    <!-- Input -->
    <ChatInput
      :conversation-id="conversationId() ?? ''"
      class="chat-input-area"
      @send="handleSend"
      @abort="abort"
    />
  </div>
</template>

<style scoped>
.chat-page {
  @apply flex flex-col h-full overflow-hidden;
}

.chat-topbar {
  @apply flex items-center justify-between px-4 py-3
         border-b border-surface-200 dark:border-surface-200
         bg-surface-50 dark:bg-surface-0
         flex-shrink-0 gap-4;
}

.chat-topbar-left  { @apply flex-1 min-w-0; }
.chat-topbar-center { @apply flex items-center justify-center; }
.chat-topbar-right { @apply flex-1 flex justify-end; }

.chat-conv-title {
  @apply text-sm font-medium text-surface-900 dark:text-surface-900 truncate;
}

.chat-messages   { @apply flex-1 min-h-0; }
.chat-input-area { @apply flex-shrink-0; }
</style>
