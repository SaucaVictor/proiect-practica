import { ref } from 'vue'
import { useChatStore } from '@/stores/chat.store'
import { useConversationStore } from '@/stores/conversation.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useProviderStore } from '@/stores/provider.store'
import { ChatService } from '@/services/ai/ChatService'
import { createMessage } from '@/services/supabase/messages'
import { updateConversation } from '@/services/supabase/conversations'
import { generateConversationTitle } from '@/utils/conversation'
import type { Message, AIRequestMessage } from '@/types'
import { useToast } from './useToast'
import { uploadAttachment } from '@/services/supabase/attachments'
import { supabase } from '@/services/supabase/client'
import type { PendingAttachment } from '@/composables/useAttachments'
import { extractTextFromPdf } from '@/utils/pdf'
import { transcribeAudio } from '@/utils/audio'

export function useChat() {
  const chatStore = useChatStore()
  const conversationStore = useConversationStore()
  const settingsStore = useSettingsStore()
  const providerStore = useProviderStore()
  const toast = useToast()

  const sending = ref(false)

  function buildAIMessages(messages: Message[]): AIRequestMessage[] {
    const list: AIRequestMessage[] = []
    for (const m of messages) {
      if (m.status === 'error' || m.optimistic) continue
      if (m.role !== 'user' && m.role !== 'assistant') continue

      let contentVal: string | any[] = m.content

      if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
        const hasImages = m.attachments.some(a => a.mimeType.startsWith('image/'))
        const activeModelSupportsVision = providerStore.activeModel?.supportsVision

        if (hasImages && activeModelSupportsVision) {
          const cleanText = m.content.replace(/<!-- FILES_CONTENT_START -->[\s\S]*<!-- FILES_CONTENT_END -->/, '').trim()
          const parts: any[] = [{ type: 'text', text: cleanText }]
          for (const att of m.attachments) {
            if (att.mimeType.startsWith('image/') && att.url) {
              parts.push({
                type: 'image_url',
                image_url: { url: att.url }
              })
            }
          }
          contentVal = parts
        }
      }

      const last = list[list.length - 1]
      if (last && last.role === m.role) {
        if (typeof last.content === 'string' && typeof contentVal === 'string') {
          last.content = (last.content + '\n' + contentVal).trim()
        } else {
          const lastParts = typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : last.content
          const newParts = typeof contentVal === 'string' ? [{ type: 'text', text: contentVal }] : contentVal
          last.content = [...lastParts, ...newParts]
        }
      } else {
        list.push({
          role: m.role as 'user' | 'assistant',
          content: contentVal as any,
        })
      }
    }
    return list
  }

  async function sendMessage(
    content: string,
    conversationId: string,
    attachments?: PendingAttachment[]
  ): Promise<void> {
    const hasPending = attachments && attachments.length > 0
    if ((!content.trim() && !hasPending) || chatStore.isStreaming) return

    sending.value = true

    const settings = settingsStore.current
    const provider = providerStore.activeProvider
    const model = providerStore.activeModelId

    // ── 1. Optimistic user message ──────────────────────────────────────────
    const optimisticUserMsg: Message = {
      id: `opt-${crypto.randomUUID()}`,
      conversationId,
      role: 'user',
      content,
      status: 'sending',
      createdAt: new Date().toISOString(),
      optimistic: true,
      attachments: attachments ? attachments.map(a => ({
        id: a.id,
        messageId: '',
        storagePath: '',
        mimeType: a.file.type,
        name: a.file.name,
        size: a.file.size,
        url: a.previewUrl
      })) : undefined
    }
    chatStore.addOptimisticMessage(optimisticUserMsg)

    // ── 2. Persist user message ─────────────────────────────────────────────
    let savedUserMsg: Message
    try {
      let dbContent = content
      if (attachments && attachments.length > 0) {
        let fileTexts = ''
        for (const att of attachments) {
          const file = att.file
          const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
          const isText = file.type.startsWith('text/') || 
                         file.name.endsWith('.txt') || 
                         file.name.endsWith('.md') || 
                         file.name.endsWith('.json') || 
                         file.name.endsWith('.js') || 
                         file.name.endsWith('.ts') ||
                         file.name.endsWith('.py') ||
                         file.name.endsWith('.html') ||
                         file.name.endsWith('.css') ||
                         file.name.endsWith('.csv') ||
                         file.name.endsWith('.xml') ||
                         file.name.endsWith('.yaml') ||
                         file.name.endsWith('.yml')

          const isAudio = file.type.startsWith('audio/') || 
                          file.name.endsWith('.mp3') || 
                          file.name.endsWith('.wav') || 
                          file.name.endsWith('.m4a') || 
                          file.name.endsWith('.ogg') || 
                          file.name.endsWith('.flac') ||
                          file.name.endsWith('.webm')

          if (isPdf) {
            try {
              const fileText = await extractTextFromPdf(file)
              fileTexts += `\n\n[Attached PDF: ${file.name}]\n${fileText}`
            } catch (err) {
              console.error('Failed to extract text from PDF', err)
            }
          } else if (isAudio) {
            try {
              toast.info('Transcribing audio file...', file.name)
              const fileText = await transcribeAudio(file, chatStore.asrMode)
              fileTexts += `\n\n[Transcription of Audio: ${file.name}]\n${fileText}`
              toast.success('Audio transcribed successfully!', file.name)
            } catch (err) {
              console.error('Failed to transcribe audio', err)
              toast.error('Failed to transcribe audio', (err as Error).message)
            }
          } else if (isText) {
            try {
              const fileText = await file.text()
              fileTexts += `\n\n[Attached File: ${file.name}]\n\`\`\`\n${fileText}\n\`\`\``
            } catch (err) {
              console.error('Failed to read file text', err)
            }
          }
        }
        if (fileTexts) {
          dbContent += `\n\n<!-- FILES_CONTENT_START -->${fileTexts}<!-- FILES_CONTENT_END -->`
        }
      }

      savedUserMsg = await createMessage({
        conversationId,
        role: 'user',
        content: dbContent,
      })

      if (attachments && attachments.length > 0) {
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData.user?.id
        if (userId) {
          const uploaded = await Promise.all(
            attachments.map(att => uploadAttachment(att.file, savedUserMsg.id, userId))
          )
          savedUserMsg.attachments = uploaded
        }
      }

      chatStore.replaceOptimisticMessage(optimisticUserMsg.id, savedUserMsg)
    } catch (err) {
      chatStore.updateMessage(optimisticUserMsg.id, { status: 'error' })
      toast.error('Failed to send message', (err as Error).message)
      sending.value = false
      return
    }

    // ── 3. Optimistic assistant message (placeholder) ───────────────────────
    const assistantMsgId = `opt-asst-${crypto.randomUUID()}`
    const optimisticAssistant: Message = {
      id: assistantMsgId,
      conversationId,
      role: 'assistant',
      content: '',
      reasoning: undefined,
      status: 'streaming',
      createdAt: new Date().toISOString(),
      optimistic: true,
    }
    chatStore.addOptimisticMessage(optimisticAssistant)
    chatStore.startStreaming(assistantMsgId)
    sending.value = false

    // ── 4. Build request ────────────────────────────────────────────────────
    const aiMessages = buildAIMessages(chatStore.messages)

    // ── 5. Stream ───────────────────────────────────────────────────────────
    if (settings.streamEnabled) {
      const controller = ChatService.stream(
        {
          provider,
          model,
          messages: aiMessages,
          systemPrompt: settings.systemPrompt || undefined,
          temperature: settings.temperature,
          topP: settings.topP,
          topK: settings.topK || undefined,
          maxTokens: settings.maxTokens,
          presencePenalty: settings.presencePenalty,
          frequencyPenalty: settings.frequencyPenalty,
        },
        {
          onToken: (token) => {
            chatStore.appendStreamToken(assistantMsgId, token)
          },
          onReasoning: (token) => {
            chatStore.appendReasoningToken(assistantMsgId, token)
          },
          onComplete: async (response) => {
            chatStore.stopStreaming()

            // Persist assistant message
            try {
              const saved = await createMessage({
                conversationId,
                role: 'assistant',
                content: response.content,
                reasoning: response.reasoning,
                metadata: response.usage
                  ? { usage: response.usage, model: response.model }
                  : undefined,
              })
              chatStore.replaceOptimisticMessage(assistantMsgId, {
                ...saved,
                status: 'done',
              })

              // Auto-rename conversation on first message
              const conv = conversationStore.getById(conversationId)
              if (conv && conv.title === 'New conversation') {
                const title = generateConversationTitle(content)
                await updateConversation(conversationId, { title })
                conversationStore.upsertFromRealtime({ id: conversationId, title })
              }
            } catch (err) {
              console.error('Failed to persist assistant message', err)
            }
          },
          onError: (err) => {
            chatStore.updateMessage(assistantMsgId, {
              status: 'error',
              content: `⚠️ ${err.message}`,
            })
            chatStore.stopStreaming()
            toast.error('AI error', err.message)
          },
        }
      )

      chatStore.setAbortController(controller)
    } else {
      // Non-streaming
      try {
        const response = await ChatService.send({
          provider,
          model,
          messages: aiMessages,
          systemPrompt: settings.systemPrompt || undefined,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
        })

        chatStore.updateMessage(assistantMsgId, {
          content: response.content,
          reasoning: response.reasoning,
          status: 'done',
        })
        chatStore.stopStreaming()

        await createMessage({
          conversationId,
          role: 'assistant',
          content: response.content,
          reasoning: response.reasoning,
        })
      } catch (err) {
        chatStore.updateMessage(assistantMsgId, {
          status: 'error',
          content: `⚠️ ${(err as Error).message}`,
        })
        chatStore.stopStreaming()
        toast.error('AI error', (err as Error).message)
      }
    }
  }

  async function regenerate(conversationId: string): Promise<void> {
    // Remove last assistant message and resend
    const messages = chatStore.messages
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistant) return

    chatStore.removeMessage(lastAssistant.id)
    // Find the last user message
    const lastUser = [...chatStore.messages].reverse().find(m => m.role === 'user')
    if (!lastUser) return

    await sendMessage(lastUser.content, conversationId)
  }

  function abort(): void {
    chatStore.abortStreaming()
  }

  return {
    sending,
    sendMessage,
    regenerate,
    abort,
  }
}
