import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Reactive breakpoint composable.
 * Returns `isMobile` (true when viewport width < 768px).
 */
export function useBreakpoint() {
  const isMobile = ref(false)

  let mq: MediaQueryList | null = null

  function update(e: MediaQueryListEvent | MediaQueryList) {
    isMobile.value = e.matches
  }

  onMounted(() => {
    mq = window.matchMedia('(max-width: 767px)')
    isMobile.value = mq.matches
    mq.addEventListener('change', update)
  })

  onUnmounted(() => {
    mq?.removeEventListener('change', update)
  })

  return { isMobile }
}
