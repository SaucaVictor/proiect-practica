import { onMounted, onUnmounted } from 'vue'

type KeyCombo = string // e.g. 'ctrl+enter', 'escape', 'ctrl+k'

interface KeyBinding {
  combo: KeyCombo
  handler: (e: KeyboardEvent) => void
  prevent?: boolean
}

export function useKeyboard(bindings: KeyBinding[]) {
  function parseCombo(combo: KeyCombo): { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean } {
    const parts = combo.toLowerCase().split('+')
    const key = parts[parts.length - 1]
    return {
      key,
      ctrl: parts.includes('ctrl'),
      shift: parts.includes('shift'),
      alt: parts.includes('alt'),
      meta: parts.includes('meta'),
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    for (const binding of bindings) {
      const { key, ctrl, shift, alt, meta } = parseCombo(binding.combo)

      const keyMatch = e.key.toLowerCase() === key || e.code.toLowerCase() === key
      const ctrlMatch = ctrl === (e.ctrlKey || e.metaKey)
      const shiftMatch = shift === e.shiftKey
      const altMatch = alt === e.altKey
      const metaMatch = !meta || e.metaKey

      if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
        if (binding.prevent) e.preventDefault()
        binding.handler(e)
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
}
