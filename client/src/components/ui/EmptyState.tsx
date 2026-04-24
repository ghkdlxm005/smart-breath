import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Icon size={28} className="text-slate-400" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
        {description && (
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
