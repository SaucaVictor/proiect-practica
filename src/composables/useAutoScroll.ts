import { ref, type Ref } from 'vue'

export function useAutoScroll(containerRef: Ref<HTMLElement | null>) {
  const isAtBottom = ref(true)
  const userScrolled = ref(false)

  function checkIfAtBottom(): void {
    const el = containerRef.value
    if (!el) return
    const threshold = 100
    isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }

  function scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    const el = containerRef.value
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }

  function handleScroll(): void {
    checkIfAtBottom()
    if (!isAtBottom.value) {
      userScrolled.value = true
    } else {
      userScrolled.value = false
    }
  }

  function onNewContent(): void {
    if (isAtBottom.value || !userScrolled.value) {
      scrollToBottom('smooth')
    }
  }

  function forceScrollToBottom(): void {
    userScrolled.value = false
    scrollToBottom('instant')
  }

  return {
    isAtBottom,
    userScrolled,
    handleScroll,
    onNewContent,
    scrollToBottom,
    forceScrollToBottom,
    checkIfAtBottom,
  }
}
