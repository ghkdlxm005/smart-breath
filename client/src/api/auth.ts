import { api } from './client'
import type { User } from '@/types'

export interface SignupPayload {
  email: string; password: string; name: string
  birth_date?: string; gender?: string
  height_cm?: number; weight_kg?: number; is_smoker?: boolean
  target_daily_sessions?: number
}

export interface LoginPayload { email: string; password: string }

export const authApi = {
  signup:  (payload: SignupPayload) =>
    api.post<{ user: User }>('/api/auth/signup', payload),
  login:   (payload: LoginPayload) =>
    api.post<{ user: User }>('/api/auth/login', payload),
  logout:  () => api.post('/api/auth/logout'),
  me:      () => api.get<{ user: User }>('/api/auth/me'),
  updateMe:(payload: Partial<User & { password?: string }>) =>
    api.patch<{ user: User }>('/api/auth/me', payload),
  deleteAccount: () => api.delete('/api/auth/me'),
}
