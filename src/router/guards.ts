import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

export async function requireAuth(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  const authStore = useAuthStore()

  // Initialize auth if not done yet
  if (!authStore.initialized) {
    await authStore.initialize()
  }

  if (authStore.isAuthenticated) {
    next()
  } else {
    next({ name: 'login', query: { redirect: to.fullPath } })
  }
}

export async function requireGuest(
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  const authStore = useAuthStore()

  if (!authStore.initialized) {
    await authStore.initialize()
  }

  if (authStore.isAuthenticated) {
    next({ name: 'chat' })
  } else {
    next()
  }
}
