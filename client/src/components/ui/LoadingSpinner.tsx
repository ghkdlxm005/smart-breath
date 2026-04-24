import { clsx } from 'clsx'

interface Props { size?: 'sm' | 'md' | 'lg'; className?: string }

export default function LoadingSpinner({ size = 'md', className }: Props) {
  const sizeMap = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-3' }
  return (
    <div className={clsx(
      'rounded-full border-slate-200 dark:border-slate-700 border-t-primary-500 animate-spin',
      sizeMap[size], className
    )} />
  )
}
