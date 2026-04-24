import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Sparkles, CheckCircle2, AlertTriangle, Info, Play, Zap } from 'lucide-react'
import { analyticsApi } from '@/api/analytics'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import type { RecommendationReason } from '@/types'

const LEVEL_LABELS = ['', '매우 낮음', '낮음', '중간', '높음', '최고']
const LEVEL_COLORS = ['', 'text-accent-500', 'text-secondary-500', 'text-primary-500', 'text-warning-500', 'text-danger-500']
const LEVEL_BG    = ['', 'bg-accent-500/10', 'bg-secondary-500/10', 'bg-primary-500/10', 'bg-warning-500/10', 'bg-danger-500/10']

function ReasonItem({ reason }: { reason: RecommendationReason }) {
  const Icon = reason.type === 'success' ? CheckCircle2
    : reason.type === 'warning' ? AlertTriangle
    : Info
  const color = reason.type === 'success' ? 'text-accent-500'
    : reason.type === 'warning' ? 'text-warning-500'
    : 'text-primary-500'

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <Icon size={16} className={clsx('mt-0.5 shrink-0', color)} />
      <p className="text-sm text-slate-700 dark:text-slate-300">{reason.text}</p>
    </div>
  )
}

export default function Recommendation() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['recommendation'],
    queryFn: analyticsApi.currentRecommendation,
  })

  const { mutate: apply, isPending } = useMutation({
    mutationFn: (level: number) => analyticsApi.applyRecommendation(level),
    onSuccess: (_, level) => {
      toast.success(`레벨 ${level} 설정 완료!`)
      qc.invalidateQueries({ queryKey: ['devices'] })
      navigate('/training')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) {
    return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  }

  const rec = data
  const level = rec?.recommended_level ?? 3
  const current = rec?.current_level ?? 1

  return (
    <div className="space-y-5 max-w-lg">
      {/* 헤더 */}
      <div className="card p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">AI 강도 추천</h2>
        <p className="text-sm text-slate-500">최근 훈련 데이터를 분석한 결과입니다</p>
      </div>

      {/* 추천 레벨 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card p-6 text-center"
      >
        {!rec?.has_enough_data ? (
          <div className="py-4">
            <p className="text-slate-500 text-sm">훈련 데이터가 부족합니다.</p>
            <p className="text-slate-400 text-xs mt-1">최소 1회 이상 훈련 후 추천을 받을 수 있습니다.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-3">추천 저항 강도</p>
            <div className={clsx(
              'inline-flex items-center gap-3 px-8 py-4 rounded-2xl mb-3',
              LEVEL_BG[level]
            )}>
              <Zap size={28} className={LEVEL_COLORS[level]} />
              <div className="text-left">
                <p className={clsx('text-4xl font-bold font-numeric', LEVEL_COLORS[level])}>
                  레벨 {level}
                </p>
                <p className={clsx('text-sm font-medium', LEVEL_COLORS[level])}>
                  {LEVEL_LABELS[level]}
                </p>
              </div>
            </div>
            {level !== current && (
              <p className="text-xs text-slate-400">
                현재 레벨 {current} →{' '}
                <span className={LEVEL_COLORS[level]}>레벨 {level}로 {level > current ? '상향' : '하향'} 추천</span>
              </p>
            )}
          </>
        )}
      </motion.div>

      {/* 추천 근거 */}
      {rec?.reasons && rec.reasons.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">추천 근거</h3>
          {rec.reasons.map((r, i) => (
            <ReasonItem key={i} reason={r} />
          ))}
        </div>
      )}

      {/* 특징값 */}
      {rec?.features && Object.keys(rec.features).length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">분석 지표</h3>
          <div className="space-y-2">
            {[
              { key: 'score_mean_7d',       label: '7일 평균 점수',     unit: '점' },
              { key: 'avg_peak_pressure_7d', label: '7일 평균 흡기압',  unit: 'Pa' },
              { key: 'sessions_per_week',   label: '주간 훈련 빈도',    unit: '회' },
              { key: 'trend_slope_14d',     label: '14일 개선 속도',    unit: '' },
            ].map(({ key, label, unit }) => {
              const val = rec.features[key]
              if (val === undefined) return null
              return (
                <div key={key} className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-numeric">
                    {typeof val === 'number' ? val.toFixed(1) : val}{unit}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 적용 버튼 */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => apply(level)}
        disabled={isPending}
        className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
      >
        {isPending ? <LoadingSpinner size="sm" /> : <Play size={18} fill="white" />}
        레벨 {level}로 훈련 시작
      </motion.button>
    </div>
  )
}
