import type { AuthUser, LoginCredentials, RegisterCredentials, UpdateProfilePayload } from '@/types'
import { supabase } from './client'

// ─── Auth operations ─────────────────────────────────────────────────────────

export async function signIn({ email, password }: LoginCredentials): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return mapUser(data.user)
}

export async function signUp({ email, password, displayName }: RegisterCredentials): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  })
  if (error) throw error
  if (!data.user) throw new Error('Registration failed — no user returned')
  return mapUser(data.user)
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${import.meta.env.VITE_APP_URL}/auth/reset`,
  })
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession()
  if (error) throw error
  return data.session
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: payload.displayName,
      avatar_url: payload.avatarUrl,
    })
    .eq('id', userData.user.id)

  if (error) throw error
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? mapUser(session.user) : null)
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown>; created_at?: string }): AuthUser {
  return {
    id: user.id,
    email: user.email ?? '',
    displayName: (user.user_metadata?.['display_name'] as string | undefined) ?? null,
    avatarUrl: (user.user_metadata?.['avatar_url'] as string | undefined) ?? null,
    createdAt: user.created_at ?? new Date().toISOString(),
  }
}
