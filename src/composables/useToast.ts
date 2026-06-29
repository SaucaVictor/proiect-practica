import { ref, computed } from 'vue'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  description?: string
  duration?: number
}

const toasts = ref<ToastMessage[]>([])

export function useToast() {
  function push(toast: Omit<ToastMessage, 'id'>): string {
    const id = crypto.randomUUID()
    const duration = toast.duration ?? 4000

    toasts.value.push({ ...toast, id })

    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }

    return id
  }

  function dismiss(id: string): void {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function success(title: string, description?: string): string {
    return push({ type: 'success', title, description })
  }

  function error(title: string, description?: string): string {
    return push({ type: 'error', title, description, duration: 6000 })
  }

  function info(title: string, description?: string): string {
    return push({ type: 'info', title, description })
  }

  function warning(title: string, description?: string): string {
    return push({ type: 'warning', title, description })
  }

  return {
    toasts: computed(() => toasts.value),
    push,
    dismiss,
    success,
    error,
    info,
    warning,
  }
}
