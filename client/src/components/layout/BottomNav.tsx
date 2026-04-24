import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Activity, BarChart3, CalendarDays, User } from 'lucide-react'
import { clsx } from 'clsx'

const tabs = [
  { to: '/dashboard', icon: LayoutDashboard, label: '홈' },
  { to: '/training',  icon: Activity,        label: '훈련' },
  { to: '/analytics', icon: BarChart3,        label: '분석' },
  { to: '/history',   icon: CalendarDays,     label: '기록' },
  { to: '/profile',   icon: User,             label: '프로필' },
]

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex">
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} className="flex-1">
          {({ isActive }) => (
            <div className={clsx(
              'flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors',
              isActive
                ? 'text-primary-500'
                : 'text-slate-400 dark:text-slate-500'
            )}>
              <Icon size={20} />
              <span>{label}</span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
