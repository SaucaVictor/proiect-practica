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
  <div v-if="!inline" class="markdown-content">
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
  @apply text-sm leading-relaxed text-surface-100 dark:text-surface-900;
}

.markdown-inline {
  @apply text-sm;
}
</style>

<style>
/* ── Markdown global styles ─────────────────────────────────────────────────
   Surface palette is DARK-FIRST:
     surface-0  = #0e0f11 (near black)   surface-950 = #e8eaf0 (near white)
   So in DARK mode: high numbers = light text, low numbers = dark bg
   In LIGHT mode: the light-mode-text.css wildcards remap surface-NNN to real light values
   ─────────────────────────────────────────────────────────────────────────── */

/* Body text — surface-950 in dark = near white (#e8eaf0). In light, overridden to dark. */
.markdown-content { color: #e8eaf0; } /* dark-mode base */

/* Headings */
.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4 { color: #f4f5f8; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; }
.markdown-content h1 { font-size: 1.25rem; }
.markdown-content h2 { font-size: 1.125rem; }
.markdown-content h3 { font-size: 1rem; }

/* Paragraphs / lists */
.markdown-content p  { margin-bottom: 0.75rem; }
.markdown-content p:last-child { margin-bottom: 0; }
.markdown-content ul { list-style-type: disc; padding-left: 1.25rem; margin-bottom: 0.75rem; }
.markdown-content ol { list-style-type: decimal; padding-left: 1.25rem; margin-bottom: 0.75rem; }
.markdown-content li { margin-bottom: 0.25rem; }

/* Bold */
.markdown-content strong { font-weight: 700; color: #f4f5f8; }

/* Blockquote */
.markdown-content blockquote {
  border-left: 2px solid #363a42;
  padding-left: 1rem;
  font-style: italic;
  color: #9aa0b2;
  margin: 0.75rem 0;
}

/* Horizontal rule */
.markdown-content hr { border-color: #2a2d33; margin: 1rem 0; }

/* Links */
.markdown-content a { color: #7c97f8; text-decoration: none; }
.markdown-content a:hover { text-decoration: underline; }

/* Inline code */
.markdown-content :not(pre) code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
  background: #212328;
  color: #a4b9fc;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  border: 1px solid #2a2d33;
}

/* Table */
.markdown-content table { width: 100%; font-size: 0.875rem; border-collapse: collapse; margin: 0.75rem 0; }
.markdown-content th {
  text-align: left; padding: 0.5rem 0.75rem; font-weight: 600;
  background: #1a1b1e; color: #9aa0b2; border-bottom: 1px solid #363a42;
}
.markdown-content td {
  padding: 0.5rem 0.75rem; border-bottom: 1px solid #212328;
}
</style>
