import type { Conversation, GroupedConversations, ConversationGroup } from '@/types'

interface GroupConfig {
  key: ConversationGroup
  label: string
  test: (c: Conversation) => boolean
}

export function groupConversations(conversations: Conversation[]): GroupedConversations[] {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000)
  const startOfLast7 = new Date(startOfToday.getTime() - 7 * 86400000)
  const startOfLast30 = new Date(startOfToday.getTime() - 30 * 86400000)

  const groups: GroupConfig[] = [
    {
      key: 'pinned',
      label: 'Pinned',
      test: c => c.pinned && !c.archived,
    },
    {
      key: 'today',
      label: 'Today',
      test: c => !c.pinned && !c.archived && new Date(c.updatedAt) >= startOfToday,
    },
    {
      key: 'yesterday',
      label: 'Yesterday',
      test: c =>
        !c.pinned &&
        !c.archived &&
        new Date(c.updatedAt) >= startOfYesterday &&
        new Date(c.updatedAt) < startOfToday,
    },
    {
      key: 'last7days',
      label: 'Previous 7 days',
      test: c =>
        !c.pinned &&
        !c.archived &&
        new Date(c.updatedAt) >= startOfLast7 &&
        new Date(c.updatedAt) < startOfYesterday,
    },
    {
      key: 'last30days',
      label: 'Previous 30 days',
      test: c =>
        !c.pinned &&
        !c.archived &&
        new Date(c.updatedAt) >= startOfLast30 &&
        new Date(c.updatedAt) < startOfLast7,
    },
    {
      key: 'older',
      label: 'Older',
      test: c => !c.pinned && !c.archived && new Date(c.updatedAt) < startOfLast30,
    },
    {
      key: 'archived',
      label: 'Archived',
      test: c => c.archived,
    },
  ]

  return groups
    .map(group => ({
      group: group.key,
      label: group.label,
      conversations: conversations.filter(group.test),
    }))
    .filter(g => g.conversations.length > 0)
}

export function generateConversationTitle(firstMessage: string): string {
  const cleaned = firstMessage.trim().replace(/\n+/g, ' ')
  if (cleaned.length <= 60) return cleaned
  return cleaned.slice(0, 57) + '…'
}
