import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { analyticsApi } from '@/api/analytics'
import TrendChart from '@/components/charts/TrendChart'
import RadarChart from '@/components/charts/RadarChart'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { BarChart3, Activity } from 'lucide-react'

type Period = '7d' | '30d' | '90d' | '180d'

export default function Analytics() {
  const [period, setPeriod] = useState<Period>('7d')
  const [pressureMetric] = useState<'avg_score' | 'avg_peak_pressure'>('avg_peak_pressure')

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', period],
    queryFn: () => analyticsApi.summary(period),
  })

  return (
    <div className="space-y-5 max-w-4xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">개인 데이터 분석</h2>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {(['7d', '30d', '90d', '180d'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === p
                  ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>{p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : !data || data.total_sessions === 0 ? (
        <EmptyState
          icon={Activity}
          title="분석 데이터 없음"
          description="훈련을 시작하면 분석 데이터가 쌓입니다."
        />
      ) : (
        <>
          {/* 요약 수치 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '총 훈련 횟수', value: `${data.total_sessions}회` },
              { label: '평균 점수',   value: `${data.avg_score}점` },
              { label: '평균 흡기압', value: `${data.avg_peak_pressure} Pa` },
              { label: '총 훈련 시간', value: `${data.total_training_min}분` },
            ].map(({ label, value }) => (
              <motion.div
                key={label}
                whileHover={{ y: -2 }}
                className="card p-4"
              >
                <p className="text-xs text-slate-400 mb-1">{label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white font-numeric">{value}</p>
              </motion.div>
            ))}
          </div>

          {/* 백분위 */}
          {data.percentile != null && (
            <div className="card p-5 flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-xl">{data.percentile}</span>
              </div>
              <div>
                <p className="text-sm text-slate-500">그룹 내 백분위</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  상위 <span className="text-primary-500">{100 - data.percentile}%</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">같은 연령·성별 그룹 대비</p>
              </div>
            </div>
          )}

          {/* 차트 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 최대 흡기압 트렌드 */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                최대 흡기압 트렌드
              </h3>
              <div className="h-44">
                {data.trend.length > 0
                  ? <TrendChart data={data.trend} metric="avg_peak_pressure" />
                  : <p className="text-xs text-slate-400 text-center mt-16">데이터 없음</p>
                }
              </div>
            </div>

            {/* 훈련 점수 트렌드 */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                훈련 점수 트렌드
              </h3>
              <div className="h-44">
                {data.trend.length > 0
                  ? <TrendChart data={data.trend} metric="avg_score" />
                  : <p className="text-xs text-slate-400 text-center mt-16">데이터 없음</p>
                }
              </div>
            </div>

            {/* 주간 훈련 빈도 */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                주간 훈련 빈도
              </h3>
              <div className="h-44">
                {data.weekly_chart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.weekly_chart} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '10px', fontSize: '12px', color: '#f1f5f9' }}
                        formatter={(v: number) => [`${v}회`]}
                      />
                      <Bar dataKey="count" fill="#0EA5E9" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-slate-400 text-center mt-16">데이터 없음</p>}
              </div>
            </div>

            {/* 능력치 레이더 */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                능력치 레이더
              </h3>
              <div className="h-44">
                {data.radar ? (
                  <RadarChart data={data.radar} />
                ) : <p className="text-xs text-slate-400 text-center mt-16">데이터 없음</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
