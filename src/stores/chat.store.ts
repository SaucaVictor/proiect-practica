import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Message } from '@/types'
import * as messagesService from '@/services/supabase/messages'
import * as conversationsService from '@/services/supabase/conversations'

export const useChatStore = defineStore('chat', () => {
  // ─── State ──────────────────────────────────────────────────────────────────
  const activeConversationId = ref<string | null>(null)
  const messages = ref<Message[]>([])
  const loading = ref(false)
  const streaming = ref(false)
  const streamingMessageId = ref<string | null>(null)
  const abortController = ref<AbortController | null>(null)
  const hasMoreMessages = ref(true)
  const page = ref(0)
  const error = ref<string | null>(null)

  // ─── Getters ────────────────────────────────────────────────────────────────

  const activeMessage = computed(() =>
    streamingMessageId.value
      ? messages.value.find(m => m.id === streamingMessageId.value)
      : null
  )

  const isStreaming = computed(() => streaming.value)
  const canSend = computed(() => !streaming.value)

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function loadConversation(conversationId: string): Promise<void> {
    loading.value = true
    error.value = null
    messages.value = []
    page.value = 0
    hasMoreMessages.value = true
    activeConversationId.value = conversationId

    try {
      const loaded = await messagesService.listMessages(conversationId, 0)
      messages.value = loaded
      hasMoreMessages.value = loaded.length === 50
    } catch (err) {
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  async function loadMoreMessages(): Promise<void> {
    if (!activeConversationId.value || !hasMoreMessages.value || loading.value) return
    loading.value = true
    page.value++
    try {
      const older = await messagesService.listMessages(activeConversationId.value, page.value)
      messages.value = [...older, ...messages.value]
      hasMoreMessages.value = older.length === 50
    } finally {
      loading.value = false
    }
  }

  function addOptimisticMessage(msg: Message): void {
    messages.value.push(msg)
  }

  function updateMessage(id: string, updates: Partial<Message>): void {
    const idx = messages.value.findIndex(m => m.id === id)
    if (idx >= 0) {
      messages.value[idx] = { ...messages.value[idx], ...updates }
    }
  }

  function removeMessage(id: string): void {
    messages.value = messages.value.filter(m => m.id !== id)
  }

  function replaceOptimisticMessage(optimisticId: string, real: Message): void {
    const idx = messages.value.findIndex(m => m.id === optimisticId)
    if (idx >= 0) {
      messages.value[idx] = real
    }
  }

  function startStreaming(messageId: string): void {
    streaming.value = true
    streamingMessageId.value = messageId
  }

  function appendStreamToken(messageId: string, token: string): void {
    const idx = messages.value.findIndex(m => m.id === messageId)
    if (idx >= 0) {
      messages.value[idx] = {
        ...messages.value[idx],
        content: messages.value[idx].content + token,
      }
    }
  }

  function appendReasoningToken(messageId: string, token: string): void {
    const idx = messages.value.findIndex(m => m.id === messageId)
    if (idx >= 0) {
      const current = messages.value[idx].reasoning ?? ''
      messages.value[idx] = {
        ...messages.value[idx],
        reasoning: current + token,
      }
    }
  }

  function stopStreaming(): void {
    streaming.value = false
    streamingMessageId.value = null
    abortController.value = null
  }

  function setAbortController(ctrl: AbortController): void {
    abortController.value = ctrl
  }

  function abortStreaming(): void {
    abortController.value?.abort()
    stopStreaming()
  }

  function clearConversation(): void {
    activeConversationId.value = null
    messages.value = []
    streaming.value = false
    streamingMessageId.value = null
    abortController.value = null
    page.value = 0
    hasMoreMessages.value = true
    error.value = null
  }

  function setError(msg: string | null): void {
    error.value = msg
  }

  return {
    activeConversationId,
    messages,
    loading,
    streaming,
    streamingMessageId,
    hasMoreMessages,
    error,
    activeMessage,
    isStreaming,
    canSend,
    loadConversation,
    loadMoreMessages,
    addOptimisticMessage,
    updateMessage,
    removeMessage,
    replaceOptimisticMessage,
    startStreaming,
    appendStreamToken,
    appendReasoningToken,
    stopStreaming,
    setAbortController,
    abortStreaming,
    clearConversation,
    setError,
  }
})

// Suppress unused import warnings
void conversationsService
void messagesService
