<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useMarkdown } from '@/composables/useMarkdown'

const CodeBlock = defineAsyncComponent(() => import('./CodeBlock.vue'))

interface Props {
  content: string
  inline?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  inline: false,
})

const { render, renderInline } = useMarkdown()

// Parse code blocks out of content for custom rendering
interface ContentPart {
  type: 'html' | 'code'
  content: string
  language?: string
}

const parts = computed<ContentPart[]>(() => {
  const raw = props.content
  const parts: ContentPart[] = []

  // Extract fenced code blocks
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(raw)) !== null) {
    // Text before this code block
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index)
      if (text.trim()) {
        parts.push({ type: 'html', content: render(text) })
      }
    }
    parts.push({
      type: 'code',
      language: match[1] || 'text',
      content: match[2].trimEnd(),
    })
    lastIndex = match.index + match[0].length
  }

  // Remaining text after last code block
  const remaining = raw.slice(lastIndex)
  if (remaining.trim()) {
    parts.push({ type: 'html', content: render(remaining) })
  }

  // If no code blocks found, render everything
  if (parts.length === 0) {
    parts.push({ type: 'html', content: render(raw) })
  }

  return parts
})
</script>

<template>
  <div v-if="!inline" class="markdown-content prose prose-invert max-w-none">
    <template v-for="(part, idx) in parts" :key="idx">
      <div v-if="part.type === 'html'" v-html="part.content" />
      <CodeBlock
        v-else
        :code="part.content"
        :language="part.language"
      />
    </template>
  </div>
  <span v-else class="markdown-inline" v-html="renderInline(content)" />
</template>

<style scoped>
.markdown-content {
  @apply text-sm leading-relaxed text-surface-900 dark:text-surface-900;
}

.markdown-inline {
  @apply text-sm;
}
</style>

<style>
/* Global prose styles for markdown content */
.markdown-content h1 { @apply text-xl font-bold mt-4 mb-2; }
.markdown-content h2 { @apply text-lg font-bold mt-4 mb-2; }
.markdown-content h3 { @apply text-base font-semibold mt-3 mb-1.5; }
.markdown-content p  { @apply mb-3 last:mb-0; }
.markdown-content ul { @apply list-disc pl-5 mb-3; }
.markdown-content ol { @apply list-decimal pl-5 mb-3; }
.markdown-content li { @apply mb-1; }
.markdown-content blockquote {
  @apply border-l-2 border-surface-400 pl-4 italic text-surface-700 dark:text-surface-700 my-3;
}
.markdown-content table { @apply w-full text-sm border-collapse my-3; }
.markdown-content th {
  @apply text-left px-3 py-2 bg-surface-200 dark:bg-surface-200
         border-b border-surface-300 dark:border-surface-300 font-semibold;
}
.markdown-content td {
  @apply px-3 py-2 border-b border-surface-200 dark:border-surface-200;
}
.markdown-content a {
  @apply text-accent-400 hover:underline;
}
.markdown-content :not(pre) code {
  @apply font-mono text-xs bg-surface-200 dark:bg-surface-200 px-1.5 py-0.5 rounded
         text-accent-300;
}
.markdown-content strong { @apply font-semibold text-surface-950 dark:text-surface-950; }
.markdown-content hr { @apply border-surface-300 dark:border-surface-300 my-4; }
</style>
