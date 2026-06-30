import { ref } from 'vue'
import { useToast } from './useToast'

export function useClipboard() {
  const { success } = useToast()
  const copied = ref(false)
  let timeout: ReturnType<typeof setTimeout> | null = null

  async function copy(text: string, label = 'Copied!'): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      success(label)

      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        copied.value = false
      }, 2000)
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      copied.value = true
      success(label)
    }
  }

  return { copy, copied }
}
