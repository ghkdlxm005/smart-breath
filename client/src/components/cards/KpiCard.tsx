import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { Info } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string | number
  unit?: string
  sub?: string
  info?: string          // ℹ️ 아이콘 hover 시 보여줄 설명
  trend?: { value: number; label: string }
  icon?: LucideIcon
  iconColor?: string
  progress?: number
  className?: string
}

/** 툴팁을 body에 portal로 렌더링 — 카드 overflow 잘림 없음 */
function InfoTooltip({ text, anchorRef }: { text: string; anchorRef: React.RefObject<HTMLButtonElement | null> }) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  // anchorRef가 연결되는 순간 위치 계산
  if (anchorRef.current && !rect) {
    setRect(anchorRef.current.getBoundingClientRect())
  }

  if (!rect) return null

  const top = rect.bottom + window.scrollY + 8
  // 왼쪽이 뷰포트 밖으로 나가지 않도록 보정
  const leftRaw = rect.left + window.scrollX
  const tooltipWidth = 208 // w-52
  const left = Math.min(leftRaw, window.innerWidth - tooltipWidth - 12)

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      style={{ position: 'absolute', top, left, width: tooltipWidth }}
      className="z-[9999] bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl leading-relaxed pointer-events-none"
    >
      {/* 말풍선 꼭지 */}
      <div className="absolute -top-1.5 left-2 w-3 h-3 bg-slate-800 dark:bg-slate-700 rotate-45 rounded-sm" />
      {text}
    </motion.div>,
    document.body,
  )
}

export default function KpiCard({
  title, value, unit, sub, info, trend, icon: Icon,
  iconColor = 'text-primary-500', progress, className,
}: KpiCardProps) {
  const trendUp = trend && trend.value >= 0
  const [showInfo, setShowInfo] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={clsx('card p-5 flex flex-col gap-3 relative', className)}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {title}
          </span>
          {/* ℹ️ 아이콘 */}
          {info && (
            <>
              <button
                ref={btnRef}
                onMouseEnter={() => setShowInfo(true)}
                onMouseLeave={() => setShowInfo(false)}
                onFocus={() => setShowInfo(true)}
                onBlur={() => setShowInfo(false)}
                className="w-4 h-4 flex items-center justify-center text-slate-300 hover:text-primary-400 transition-colors"
                aria-label="지표 설명"
              >
                <Info size={13} />
              </button>
              <AnimatePresence>
                {showInfo && <InfoTooltip text={info} anchorRef={btnRef} />}
              </AnimatePresence>
            </>
          )}
        </div>

        {Icon && (
          <div className={clsx('w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center', iconColor)}>
            <Icon size={16} />
          </div>
        )}
      </div>

      {/* 메인 수치 */}
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold text-slate-900 dark:text-white font-numeric leading-none">
          {value}
        </span>
        {unit && (
          <span className="text-sm text-slate-400 dark:text-slate-500 mb-0.5">{unit}</span>
        )}
      </div>

      {/* 프로그레스바 */}
      {progress !== undefined && (
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, progress)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full"
          />
        </div>
      )}

      {/* 하단: 설명 + 트렌드 */}
      <div className="flex items-center justify-between">
        {sub && <span className="text-xs text-slate-400 dark:text-slate-500">{sub}</span>}
        {trend && (
          <span className={clsx(
            'text-xs font-semibold',
            trendUp ? 'text-accent-500' : 'text-danger-500'
          )}>
            {trendUp ? '▲' : '▼'} {Math.abs(trend.value)}% {trend.label}
          </span>
        )}
      </div>
    </motion.div>
  )
}
