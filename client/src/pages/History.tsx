import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CalendarDays, List, ChevronRight } from 'lucide-react'
import { sessionsApi } from '@/api/sessions'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { clsx } from 'clsx'
import type { TrainingSession } from '@/types'

type ViewMode = 'calendar' | 'list'

function CalendarView({ sessions }: { sessions: TrainingSession[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })
  const navigate = useNavigate()

  const getSessionsForDay = (day: Date) =>
    sessions.filter(s => s.started_at && isSameDay(new Date(s.started_at), day))

  const startWeekday = getDay(days[0]) // 0=일, 6=토

  return (
    <div className="card p-5">
      {/* 월 네비 */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
          ←
        </button>
        <h3 className="font-semibold text-slate-800 dark:text-white">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </h3>
        <button onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
          →
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-2">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
          <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {/* 빈 칸 채우기 */}
        {Array.from({ length: startWeekday }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(day => {
          const daySessions = getSessionsForDay(day)
          const hasSession = daySessions.length > 0
          const isToday = isSameDay(day, new Date())
          const maxScore = hasSession
            ? Math.max(...daySessions.map(s => s.score ?? 0))
            : 0
          const intensity = hasSession
            ? maxScore >= 80 ? 'high' : maxScore >= 60 ? 'mid' : 'low'
            : 'none'

          return (
            <motion.button
              key={day.toISOString()}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (hasSession && daySessions[0]) {
                  navigate(`/training/result/${daySessions[0].id}`)
                }
              }}
              disabled={!hasSession}
              className={clsx(
                'aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all',
                isToday && 'ring-2 ring-primary-500',
                intensity === 'high' && 'bg-primary-500 text-white',
                intensity === 'mid'  && 'bg-primary-500/40 text-primary-700 dark:text-primary-300',
                intensity === 'low'  && 'bg-primary-500/15 text-primary-600 dark:text-primary-400',
                intensity === 'none' && 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              {format(day, 'd')}
            </motion.button>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 justify-center text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-primary-500/15" /> 낮음
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-primary-500/40" /> 보통
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-primary-500" /> 높음
        </span>
      </div>
    </div>
  )
}

export default function History() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', 'list', page],
    queryFn: () => sessionsApi.list({ page, per_page: 20 } as any),
  })

  // 캘린더용 전체 목록 (최근 90일)
  const { data: allData } = useQuery({
    queryKey: ['sessions', 'all'],
    queryFn: () => sessionsApi.list({ per_page: 200 } as any),
    enabled: viewMode === 'calendar',
  })

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">훈련 기록</h2>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button onClick={() => setViewMode('list')}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500')}>
            <List size={14} /> 목록
          </button>
          <button onClick={() => setViewMode('calendar')}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500')}>
            <CalendarDays size={14} /> 캘린더
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : viewMode === 'calendar' ? (
        <CalendarView sessions={allData?.sessions ?? []} />
      ) : !data?.sessions.length ? (
        <EmptyState icon={CalendarDays} title="훈련 기록 없음" description="첫 훈련을 시작해보세요!" />
      ) : (
        <>
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {data.sessions.map(s => {
              const score = s.score ?? 0
              const scoreColor = score >= 80 ? 'text-accent-500' : score >= 60 ? 'text-primary-500' : 'text-warning-500'
              return (
                <motion.button
                  key={s.id}
                  whileHover={{ x: 2 }}
                  onClick={() => navigate(`/training/result/${s.id}`)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      레벨 {s.level ?? '-'} 훈련
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {s.started_at ? format(new Date(s.started_at), 'M/d (EEEE) HH:mm', { locale: ko }) : ''}
                      {' · '}
                      {Math.round((s.duration_seconds ?? 0) / 60)}분
                      {' · '}
                      {s.total_cycles ?? 0}사이클
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={clsx('text-lg font-bold font-numeric', scoreColor)}>{score}점</p>
                      <p className="text-xs text-slate-400">{s.avg_peak_pressure?.toFixed(0) ?? '-'} Pa</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* 페이지네이션 */}
          {data.pages > 1 && (
            <div className="flex justify-center gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="btn-secondary text-sm px-4 py-2 disabled:opacity-40">이전</button>
              <span className="flex items-center text-sm text-slate-500">{page} / {data.pages}</span>
              <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}
                className="btn-secondary text-sm px-4 py-2 disabled:opacity-40">다음</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
