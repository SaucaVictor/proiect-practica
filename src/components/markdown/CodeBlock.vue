<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getHighlighter, type Highlighter } from 'shiki'
import { useClipboard } from '@/composables/useClipboard'

interface Props {
  code: string
  language?: string
  filename?: string
}

const props = withDefaults(defineProps<Props>(), {
  language: 'text',
})

const { copy, copied } = useClipboard()
const highlighted = ref('')
const highlighterRef = ref<Highlighter | null>(null)

onMounted(async () => {
  try {
    const hl = await getHighlighter({
      themes: ['github-dark-dimmed', 'github-light'],
      langs: [
        props.language as 'text',
        'typescript', 'javascript', 'python', 'rust', 'go', 'sql',
        'bash', 'json', 'yaml', 'html', 'css', 'vue', 'jsx', 'tsx',
        'markdown', 'cpp', 'java', 'csharp',
      ].filter(Boolean),
    })
    highlighterRef.value = hl
    renderCode()
  } catch {
    highlighted.value = `<pre><code>${escapeHtml(props.code)}</code></pre>`
  }
})

function renderCode() {
  if (!highlighterRef.value) return
  try {
    highlighted.value = highlighterRef.value.codeToHtml(props.code, {
      lang: props.language ?? 'text',
      themes: { dark: 'github-dark-dimmed', light: 'github-light' },
      defaultColor: false,
    })
  } catch {
    highlighted.value = `<pre><code>${escapeHtml(props.code)}</code></pre>`
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const displayLanguage = computed(() => props.language ?? 'text')
</script>

<template>
  <div class="code-block">
    <!-- Header -->
    <div class="code-block-header">
      <span class="code-block-lang">{{ displayLanguage }}</span>
      <span v-if="filename" class="code-block-file">{{ filename }}</span>

      <button
        class="code-block-copy"
        :aria-label="copied ? 'Copied!' : 'Copy code'"
        :title="copied ? 'Copied!' : 'Copy code'"
        @click="copy(code)"
      >
        <svg v-if="!copied" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2" />
          <path d="M2 10V3a1 1 0 0 1 1-1h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {{ copied ? 'Copied!' : 'Copy' }}
      </button>
    </div>

    <!-- Code -->
    <div
      v-if="highlighted"
      class="code-block-body shiki-wrapper"
      v-html="highlighted"
    />
    <pre v-else class="code-block-body"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
.code-block {
  @apply rounded-xl overflow-hidden border border-surface-300 dark:border-surface-300 my-3;
}

.code-block-header {
  @apply flex items-center gap-2 px-4 py-2.5
         bg-surface-200 dark:bg-surface-200
         border-b border-surface-300 dark:border-surface-300;
}

.code-block-lang {
  @apply text-xs font-mono font-medium text-surface-700 dark:text-surface-700;
}

.code-block-file {
  @apply text-xs text-surface-600 dark:text-surface-600 flex-1 truncate;
}

.code-block-copy {
  @apply flex items-center gap-1.5 ml-auto text-xs text-surface-600 dark:text-surface-600
         hover:text-surface-950 dark:hover:text-surface-950
         transition-colors duration-150;
}

.code-block-body {
  @apply overflow-x-auto text-sm;
}
</style>

<style>
/* Global — scoped won't penetrate v-html */
.shiki-wrapper pre {
  @apply p-4 m-0 text-sm leading-relaxed overflow-x-auto;
}

.shiki-wrapper code {
  @apply font-mono;
}
</style>
