import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Trophy, Wind, Clock, Activity, RotateCcw, Home, TrendingUp } from 'lucide-react'
import { sessionsApi } from '@/api/sessions'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

function ScoreRing({ score }: { score: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score >= 80 ? '#22C55E' : score >= 60 ? '#0EA5E9' : '#F59E0B'

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="10" />
        <motion.circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="text-4xl font-bold"
          style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-slate-400">점</span>
      </div>
    </div>
  )
}

export default function TrainingResult() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const sessionId = Number(id)

  const { data: sessionData, isLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionsApi.get(sessionId),
    enabled: !!sessionId,
  })

  const { data: samplesData } = useQuery({
    queryKey: ['session-samples', sessionId],
    queryFn: () => sessionsApi.samples(sessionId, 1000),
    enabled: !!sessionId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const session = sessionData?.session
  if (!session) return <p className="text-slate-400 text-center py-20">세션을 찾을 수 없습니다.</p>

  const score = session.score ?? 0
  const durationMin = Math.floor((session.duration_seconds ?? 0) / 60)
  const durationSec = Math.round((session.duration_seconds ?? 0) % 60)

  const chartData = (samplesData?.samples ?? []).map((s, i) => ({
    i, dp: s.dp_pa
  }))

  // AI 코멘트 생성 (규칙 기반)
  let aiComment = '훈련을 완료했습니다. 지속적인 훈련이 호흡근 강화에 도움이 됩니다.'
  if (score >= 85) {
    aiComment = `훌륭한 훈련이었습니다! 점수 ${score}점으로 목표 범위를 잘 유지했어요. 다음 훈련에서 레벨 업을 고려해보세요.`
  } else if (score >= 70) {
    aiComment = `좋은 훈련이었습니다. 평균 흡기압 ${session.avg_peak_pressure?.toFixed(0) ?? 0}Pa를 기록했어요. 호기 안정성을 더 신경 써보세요.`
  } else if (score < 60) {
    aiComment = `아직 적응 중이에요. 현재 레벨에 익숙해질 때까지 꾸준히 연습하면 점수가 오를 거예요.`
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* 헤더 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy className="text-warning-500" size={20} />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">훈련 완료!</h2>
        </div>
        <p className="text-xs text-slate-400 mb-6">
          {session.started_at
            ? format(new Date(session.started_at), 'PPP HH:mm', { locale: ko })
            : ''}
          {' · '}레벨 {session.level}
        </p>
        <ScoreRing score={score} />
      </motion.div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Wind,     label: '호흡 사이클',    value: `${session.total_cycles ?? 0}회` },
          { icon: Activity, label: '평균 흡기압',    value: `${session.avg_peak_pressure?.toFixed(0) ?? 0} Pa` },
          { icon: TrendingUp, label: '최대 압력',   value: `${session.max_pressure?.toFixed(0) ?? 0} Pa` },
          { icon: Clock,    label: '훈련 시간',      value: `${durationMin}분 ${durationSec}초` },
        ].map(({ icon: Icon, label, value }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-4 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500">
              <Icon size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="font-bold text-slate-900 dark:text-white font-numeric">{value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 파형 리플레이 */}
      {chartData.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4">전체 파형</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="replayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="i" hide />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={35} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '10px', fontSize: '11px', color: '#f1f5f9' }}
                  formatter={(v: number) => [`${v.toFixed(1)} Pa`]}
                  labelFormatter={() => ''}
                />
                <Area type="monotone" dataKey="dp" stroke="#0EA5E9" strokeWidth={1.5}
                  fill="url(#replayGrad)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* AI 코멘트 */}
      <div className="card p-5 bg-gradient-to-br from-primary-500/5 to-secondary-500/5 border-primary-500/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-500/15 flex items-center justify-center text-primary-500 shrink-0 mt-0.5">
            ✨
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-1">AI 피드백</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{aiComment}</p>
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-3 pb-4">
        <button onClick={() => navigate('/training')}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          <RotateCcw size={16} /> 다시 훈련
        </button>
        <button onClick={() => navigate('/dashboard')}
          className="btn-secondary flex items-center justify-center gap-2 px-5">
          <Home size={16} /> 홈
        </button>
      </div>
    </div>
  )
}
