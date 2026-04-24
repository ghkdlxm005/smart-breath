import { Sun, Moon, Bell, LogOut } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { useLogout } from '@/hooks/useAuth'

export default function TopBar() {
  const { user, isDark, toggleDark } = useAuthStore()
  const { mutate: logout, isPending } = useLogout()

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 md:px-6 shrink-0">
      {/* 좌측: 모바일 로고 */}
      <div className="md:hidden font-bold text-primary-500 text-sm">🫁 스마트 호흡</div>

      {/* 좌측 데스크톱: 사용자 인사 */}
      <div className="hidden md:block">
        {user && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            안녕하세요, <span className="font-semibold text-slate-900 dark:text-white">{user.name}</span>님 👋
          </p>
        )}
      </div>

      {/* 우측 액션 */}
      <div className="flex items-center gap-1">
        {/* 알림 (더미) */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="알림"
        >
          <Bell size={17} />
        </motion.button>

        {/* 다크모드 토글 */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleDark}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="테마 전환"
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </motion.button>

        {/* 로그아웃 */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => logout()}
          disabled={isPending}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          aria-label="로그아웃"
        >
          <LogOut size={17} />
        </motion.button>
      </div>
    </header>
  )
}
