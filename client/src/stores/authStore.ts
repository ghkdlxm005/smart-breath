import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
  isDark: boolean
  toggleDark: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      isDark: false,
      toggleDark: () =>
        set((s) => {
          const next = !s.isDark
          document.documentElement.classList.toggle('dark', next)
          return { isDark: next }
        }),
    }),
    {
      name: 'smart-breath-auth',
      partialize: (s) => ({ user: s.user, isDark: s.isDark }),
      onRehydrateStorage: () => (state) => {
        // 다크모드 복원
        if (state?.isDark) {
          document.documentElement.classList.add('dark')
        }
      },
    }
  )
)
