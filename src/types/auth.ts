export interface AuthUser {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  createdAt: string
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: AuthUser
}

export interface AuthState {
  user: AuthUser | null
  session: AuthSession | null
  loading: boolean
  initialized: boolean
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterCredentials {
  email: string
  password: string
  displayName: string
}

export interface ResetPasswordPayload {
  email: string
}

export interface UpdateProfilePayload {
  displayName?: string
  avatarUrl?: string
}
