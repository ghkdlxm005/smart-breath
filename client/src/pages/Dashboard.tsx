import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Play, BarChart3, Activity, Timer, Flame, Target, Wifi, WifiOff } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { analyticsApi } from '@/api/analytics'
import { sessionsApi } from '@/api/sessions'
import { deviceApi } from '@/api/device'
import KpiCard from '@/components/cards/KpiCard'
import TrendChart from '@/components/charts/TrendChart'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { TrendPoint } from '@/types'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

type Period = '7d' | '30d' | '90d'

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('7d')
  const [chartMetric, setChartMetric] = useState<'avg_score' | 'avg_peak_pressure'>('avg_score')

  const { data: summary, isLoading } = useQuery({
    queryKey: ['analytics', period],
    queryFn: () => analyticsApi.summary(period),
  })

  const { data: recentSessions } = useQuery({
    queryKey: ['sessions', 'recent'],
    queryFn: () => sessionsApi.list({ per_page: 5 } as any),
  })

  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: deviceApi.list,
  })

  const device = devicesData?.devices?.[0]
  const todaySessions = recentSessions?.sessions?.filter(s => {
    if (!s.started_at) return false
    return new Date(s.started_at).toDateString() === new Date().toDateString()
  }) ?? []

  const targetSessions = user?.target_daily_sessions ?? 3
  const todayCount = todaySessions.length
  const progressPct = Math.round((todayCount / targetSessions) * 100)

  const lastSession = recentSessions?.sessions?.[0]

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 헤더 Hero */}
      <div className="card p-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            안녕하세요, {user?.name}님 👋
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {format(new Date(), 'PPP (EEEE)', { locale: ko })}
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
          device?.is_online
            ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
        }`}>
          {device?.is_online ? <Wifi size={12} /> : <WifiOff size={12} />}
          {device?.is_online ? 'Online' : device ? 'Offline' : '기기 없음'}
        </div>
      </div>

      {/* KPI 카드 2×2 */}
      {isLoading ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="오늘의 훈련"
            value={`${todayCount} / ${targetSessions}`}
            unit="회"
            sub="일일 목표"
            info="오늘 완료한 훈련 횟수와 일일 목표 횟수입니다. 꾸준한 훈련이 호흡 근육 강화에 도움이 됩니다."
            icon={Target}
            iconColor="text-primary-500"
            progress={progressPct}
          />
          <KpiCard
            title="평균 최대 흡기압"
            value={summary?.avg_peak_pressure ?? 0}
            unit="Pa"
            info="선택한 기간 동안 각 훈련 세션의 최대 흡기 차압 평균값입니다. 수치가 높을수록 흡기 근력이 강한 것을 의미합니다."
            icon={Activity}
            iconColor="text-accent-500"
            trend={summary && summary.avg_peak_pressure > 0
              ? { value: 8, label: '지난주 대비' }
              : undefined}
          />
          <KpiCard
            title="총 훈련 시간"
            value={summary ? `${summary.total_training_min}` : '0'}
            unit="분"
            sub={`${period} 기준`}
            info="선택한 기간 동안 누적된 총 훈련 시간입니다. 하루 10~20분 규칙적인 훈련을 권장합니다."
            icon={Timer}
            iconColor="text-secondary-500"
          />
          <KpiCard
            title="훈련 강도"
            value={`레벨 ${device?.current_level ?? 1}`}
            unit="/ 5"
            sub="현재 설정"
            info="현재 설정된 저항 레벨입니다. 레벨이 높을수록 더 강한 호흡 저항이 적용되어 근육에 더 많은 부하를 줍니다."
            icon={Flame}
            iconColor="text-warning-500"
          />
        </div>
      )}

      {/* 트렌드 차트 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-white">훈련 트렌드</h3>
          <div className="flex gap-2">
            {/* 기간 토글 */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              {(['7d', '30d', '90d'] as Period[]).map(p => (
                <button key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    period === p
                      ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}>{p}
                </button>
              ))}
            </div>
            {/* 지표 토글 */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              {[
                { key: 'avg_score' as const, label: '점수' },
                { key: 'avg_peak_pressure' as const, label: '압력' },
              ].map(({ key, label }) => (
                <button key={key}
                  onClick={() => setChartMetric(key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    chartMetric === key
                      ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}>{label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-52">
          {summary?.trend && summary.trend.length > 0 ? (
            <TrendChart data={summary.trend} metric={chartMetric} />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              훈련 데이터가 없습니다
            </div>
          )}
        </div>
      </div>

      {/* 최근 세션 */}
      {recentSessions && recentSessions.sessions.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4">최근 훈련</h3>
          <div className="space-y-2">
            {recentSessions.sessions.slice(0, 4).map(s => (
              <button
                key={s.id}
                onClick={() => navigate(`/training/result/${s.id}`)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    레벨 {s.level} 훈련
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {s.started_at ? format(new Date(s.started_at), 'MM/dd HH:mm') : ''}
                    {' · '}
                    {Math.round((s.duration_seconds || 0) / 60)}분
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary-500">{s.score ?? '-'}점</p>
                    <p className="text-xs text-slate-400">{s.total_cycles ?? 0}회 사이클</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/training')}
          className="btn-primary flex items-center gap-2 flex-1 justify-center text-base py-4"
        >
          <Play size={18} fill="white" />
          훈련 시작
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/analytics')}
          className="btn-secondary flex items-center gap-2 justify-center px-6 py-4"
        >
          <BarChart3 size={18} />
          분석 보기
        </motion.button>
      </div>
    </div>
  )
}
