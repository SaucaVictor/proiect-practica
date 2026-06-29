import { marked, type MarkedExtension } from 'marked'
import markedKatex from 'marked-katex-extension'
import DOMPurify from 'dompurify'

// Configure marked with extensions
marked.use(markedKatex({ throwOnError: false, output: 'html' }) as MarkedExtension)

marked.setOptions({
  gfm: true,
  breaks: true,
})

// DOMPurify config — allow math output and common markdown elements
const PURIFY_CONFIG = {
  ADD_TAGS: [...['math', 'annotation', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mover', 'munder', 'span']],
  ADD_ATTR: [...['class', 'style', 'xmlns', 'display', 'encoding']],
  ALLOW_DATA_ATTR: false,
}

export function useMarkdown() {
  function render(raw: string): string {
    if (!raw) return ''
    // Extract code blocks before processing to avoid double-processing
    const html = marked.parse(raw) as string
    return DOMPurify.sanitize(html, PURIFY_CONFIG)
  }

  function renderInline(raw: string): string {
    if (!raw) return ''
    const html = marked.parseInline(raw) as string
    return DOMPurify.sanitize(html, PURIFY_CONFIG)
  }

  return { render, renderInline }
}
