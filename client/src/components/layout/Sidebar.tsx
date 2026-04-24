import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Activity, BarChart3, Sparkles,
  CalendarDays, Smartphone, User, Wind,
} from 'lucide-react'
import { clsx } from 'clsx'

const navItems = [
  { to: '/dashboard',      icon: LayoutDashboard, label: '대시보드' },
  { to: '/training',       icon: Activity,        label: '훈련' },
  { to: '/analytics',      icon: BarChart3,        label: '분석' },
  { to: '/recommendation', icon: Sparkles,         label: 'AI 추천' },
  { to: '/history',        icon: CalendarDays,     label: '기록' },
  { to: '/device',         icon: Smartphone,       label: '기기' },
  { to: '/profile',        icon: User,             label: '프로필' },
]

export default function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-60 h-screen bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 shrink-0">
      {/* 로고 */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 dark:border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
          <Wind className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">스마트</p>
          <p className="font-bold text-sm text-primary-500 leading-tight">호흡 훈련기</p>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <motion.div
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 cursor-pointer',
                  isActive
                    ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" size={18} />
                {label}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500"
                  />
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* 하단 버전 */}
      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs text-slate-400">v1.0.0 · 스마트 호흡 훈련기</p>
      </div>
    </aside>
  )
}
