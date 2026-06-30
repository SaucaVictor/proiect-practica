import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Conversation, ConversationFilters, GroupedConversations } from '@/types'
import * as conversationsService from '@/services/supabase/conversations'
import { groupConversations } from '@/utils/conversation'

export const useConversationStore = defineStore('conversations', () => {
  // ─── State ──────────────────────────────────────────────────────────────────
  const conversations = ref<Conversation[]>([])
  const loading = ref(false)
  const searchQuery = ref('')

  // ─── Getters ────────────────────────────────────────────────────────────────

  const filteredConversations = computed(() => {
    if (!searchQuery.value) return conversations.value
    const q = searchQuery.value.toLowerCase()
    return conversations.value.filter(c => c.title.toLowerCase().includes(q))
  })

  const grouped = computed<GroupedConversations[]>(() => {
    return groupConversations(filteredConversations.value)
  })

  const pinned = computed(() => conversations.value.filter(c => c.pinned && !c.archived))
  const archived = computed(() => conversations.value.filter(c => c.archived))

  function getById(id: string): Conversation | undefined {
    return conversations.value.find(c => c.id === id)
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function load(filters?: ConversationFilters): Promise<void> {
    loading.value = true
    try {
      conversations.value = await conversationsService.listConversations(filters)
    } finally {
      loading.value = false
    }
  }

  async function create(payload: { title?: string; model: string; provider: string }): Promise<Conversation> {
    const conversation = await conversationsService.createConversation(payload)
    conversations.value.unshift(conversation)
    return conversation
  }

  async function rename(id: string, title: string): Promise<void> {
    await conversationsService.updateConversation(id, { title })
    const idx = conversations.value.findIndex(c => c.id === id)
    if (idx >= 0) conversations.value[idx] = { ...conversations.value[idx], title }
  }

  async function update(
    id: string,
    updates: Partial<Pick<Conversation, 'title' | 'model' | 'provider' | 'pinned' | 'archived'>>
  ): Promise<void> {
    await conversationsService.updateConversation(id, updates)
    const idx = conversations.value.findIndex(c => c.id === id)
    if (idx >= 0) {
      conversations.value[idx] = { ...conversations.value[idx], ...updates }
    }
  }

  async function remove(id: string): Promise<void> {
    await conversationsService.deleteConversation(id)
    conversations.value = conversations.value.filter(c => c.id !== id)
  }

  async function pin(id: string, pinned: boolean): Promise<void> {
    await conversationsService.pinConversation(id, pinned)
    const idx = conversations.value.findIndex(c => c.id === id)
    if (idx >= 0) conversations.value[idx] = { ...conversations.value[idx], pinned }
  }

  async function archive(id: string): Promise<void> {
    await conversationsService.archiveConversation(id)
    const idx = conversations.value.findIndex(c => c.id === id)
    if (idx >= 0) conversations.value[idx] = { ...conversations.value[idx], archived: true }
  }

  function upsertFromRealtime(data: Partial<Conversation>): void {
    if (!data.id) return
    const idx = conversations.value.findIndex(c => c.id === data.id)
    if (idx >= 0) {
      conversations.value[idx] = { ...conversations.value[idx], ...data }
    } else {
      conversations.value.unshift(data as Conversation)
    }
  }

  function removeFromRealtime(id: string): void {
    conversations.value = conversations.value.filter(c => c.id !== id)
  }

  function setSearch(q: string): void {
    searchQuery.value = q
  }

  function clear(): void {
    conversations.value = []
    searchQuery.value = ''
  }

  return {
    conversations,
    loading,
    searchQuery,
    filteredConversations,
    grouped,
    pinned,
    archived,
    getById,
    load,
    create,
    rename,
    update,
    remove,
    pin,
    archive,
    upsertFromRealtime,
    removeFromRealtime,
    setSearch,
    clear,
  }
})
