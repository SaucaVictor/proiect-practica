import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileReference } from '@/types/references'

import { getCourseTranscript, getCourseFileUrl } from '@/services/supabase/courses'
import { extractTextFromPdfUrl } from '@/utils/pdf'

function nanoid(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len)
}

export const useReferencesStore = defineStore('references', () => {
  /** References attached to the current (unsent) message */
  const pending = ref<FileReference[]>([])

  /**
   * When set, the CourseResourcePanel should scroll to / highlight this reference.
   * Cleared automatically after the panel has handled it.
   */
  const focusRef = ref<FileReference | null>(null)

  function addReference(ref: Omit<FileReference, 'id'>) {
    const isDupe = pending.value.some(
      (r) =>
        r.subject === ref.subject &&
        r.date === ref.date &&
        r.filename === ref.filename &&
        r.refType === ref.refType &&
        r.startOffset === ref.startOffset &&
        r.pageNumber === ref.pageNumber
    )
    if (isDupe) return
    pending.value.push({ ...ref, id: nanoid() })
  }

  async function addReferenceAsync(ref: Omit<FileReference, 'id' | 'extractedText'>) {
    let extractedText = ''
    try {
      if (ref.refType === 'text-selection' && ref.selectedText) {
        extractedText = ref.selectedText
      } else if (ref.refType === 'whole-file') {
        if (ref.filename.endsWith('.txt')) {
          const text = await getCourseTranscript(ref.subject, ref.date, ref.filename)
          extractedText = text ?? ''
        } else if (ref.filename.endsWith('.pdf')) {
          const url = getCourseFileUrl(ref.subject, ref.date, ref.filename)
          const text = await extractTextFromPdfUrl(url)
          extractedText = text ?? ''
        }
      } else if (ref.refType === 'pdf-page' && ref.pageNumber !== undefined) {
        const url = getCourseFileUrl(ref.subject, ref.date, ref.filename)
        const text = await extractTextFromPdfUrl(url, ref.pageNumber)
        extractedText = text ?? ''
      }
    } catch (err) {
      console.error('Failed to extract reference text:', err)
    }

    addReference({ ...ref, extractedText })
  }

  function removeReference(id: string) {
    pending.value = pending.value.filter((r) => r.id !== id)
  }

  function clearReferences() {
    pending.value = []
  }

  function focusReference(ref: FileReference) {
    focusRef.value = ref
  }

  function clearFocus() {
    focusRef.value = null
  }

  /** Serialize all pending refs into a context block to prepend to a message */
  function serializeReferences(): string {
    if (pending.value.length === 0) return ''
    const blocks = pending.value.map((r) => {
      let header = `[Reference: ${r.label}]`
      if (r.refType === 'pdf-page') {
        header += ` — Page ${r.pageNumber}`
      }
      if (r.refType === 'text-selection' && r.selectedText) {
        return `${header}\n"${r.selectedText}"`
      }
      if (r.refType === 'whole-file') {
        return `${header} (whole file)`
      }
      return header
    })
    return blocks.join('\n\n') + '\n\n---\n\n'
  }

  return {
    pending,
    focusRef,
    addReference,
    addReferenceAsync,
    removeReference,
    clearReferences,
    focusReference,
    clearFocus,
    serializeReferences,
  }
})
