import { ref, computed } from 'vue'
import { useToast } from './useToast'
import { formatFileSize } from '@/utils/format'

const MAX_SIZE_MB = 20
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
]

export interface PendingAttachment {
  id: string
  file: File
  previewUrl?: string
  type: 'image' | 'document'
}

export function useAttachments() {
  const { error, warning } = useToast()
  const pendingAttachments = ref<PendingAttachment[]>([])
  const isDragging = ref(false)

  const hasAttachments = computed(() => pendingAttachments.value.length > 0)
  const hasImages = computed(() => pendingAttachments.value.some(a => a.type === 'image'))

  function validateFile(file: File): boolean {
    if (!ALLOWED_TYPES.includes(file.type)) {
      warning('Unsupported file type', `${file.type} is not supported`)
      return false
    }
    if (file.size > MAX_SIZE_BYTES) {
      error('File too large', `Max size is ${MAX_SIZE_MB} MB. Your file is ${formatFileSize(file.size)}`)
      return false
    }
    return true
  }

  function addFiles(files: File[]): void {
    for (const file of files) {
      if (!validateFile(file)) continue
      if (pendingAttachments.value.length >= 5) {
        warning('Too many attachments', 'Maximum 5 attachments per message')
        break
      }

      const isImage = file.type.startsWith('image/')
      const attachment: PendingAttachment = {
        id: crypto.randomUUID(),
        file,
        type: isImage ? 'image' : 'document',
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      }
      pendingAttachments.value.push(attachment)
    }
  }

  function removeAttachment(id: string): void {
    const attachment = pendingAttachments.value.find(a => a.id === id)
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl)
    }
    pendingAttachments.value = pendingAttachments.value.filter(a => a.id !== id)
  }

  function clearAttachments(): void {
    pendingAttachments.value.forEach(a => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
    })
    pendingAttachments.value = []
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault()
    isDragging.value = false
    const files = Array.from(event.dataTransfer?.files ?? [])
    addFiles(files)
  }

  function handleDragOver(event: DragEvent): void {
    event.preventDefault()
    isDragging.value = true
  }

  function handleDragLeave(): void {
    isDragging.value = false
  }

  function handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    addFiles(files)
    input.value = ''
  }

  return {
    pendingAttachments,
    isDragging,
    hasAttachments,
    hasImages,
    addFiles,
    removeAttachment,
    clearAttachments,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileInput,
  }
}
