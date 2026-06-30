import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser, LoginCredentials, RegisterCredentials } from '@/types'
import * as authService from '@/services/supabase/auth'
import { getSession } from '@/services/supabase/auth'

export const useAuthStore = defineStore('auth', () => {
  // ─── State ──────────────────────────────────────────────────────────────────
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)
  const initialized = ref(false)
  const error = ref<string | null>(null)

  // ─── Getters ────────────────────────────────────────────────────────────────
  const isAuthenticated = computed(() => !!user.value)
  const displayName = computed(() => user.value?.displayName ?? user.value?.email ?? 'User')

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function initialize(): Promise<void> {
    if (initialized.value) return
    try {
      const session = await getSession()
      if (session?.user) {
        user.value = {
          id: session.user.id,
          email: session.user.email ?? '',
          displayName: (session.user.user_metadata?.['display_name'] as string | undefined) ?? null,
          avatarUrl: (session.user.user_metadata?.['avatar_url'] as string | undefined) ?? null,
          createdAt: session.user.created_at ?? new Date().toISOString(),
        }
      }
    } catch {
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function login(credentials: LoginCredentials): Promise<void> {
    loading.value = true
    error.value = null
    try {
      user.value = await authService.signIn(credentials)
    } catch (err) {
      error.value = (err as Error).message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function register(credentials: RegisterCredentials): Promise<void> {
    loading.value = true
    error.value = null
    try {
      user.value = await authService.signUp(credentials)
    } catch (err) {
      error.value = (err as Error).message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    loading.value = true
    try {
      await authService.signOut()
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function sendPasswordReset(email: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await authService.resetPassword(email)
    } catch (err) {
      error.value = (err as Error).message
      throw err
    } finally {
      loading.value = false
    }
  }

  function setUser(u: AuthUser | null): void {
    user.value = u
  }

  function clearError(): void {
    error.value = null
  }

  return {
    user,
    loading,
    initialized,
    error,
    isAuthenticated,
    displayName,
    initialize,
    login,
    register,
    logout,
    sendPasswordReset,
    setUser,
    clearError,
  }
})
