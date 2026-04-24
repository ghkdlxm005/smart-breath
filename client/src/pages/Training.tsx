import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Pause, Play, Square } from 'lucide-react'
import KpiCard from '@/components/cards/KpiCard'
import { useTrainingSocket } from '@/hooks/useSocket'
import { useTrainingStore } from '@/stores/trainingStore'
import { sessionsApi } from '@/api/sessions'
import { deviceApi } from '@/api/device'
import { analyticsApi } from '@/api/analytics'
import { useQuery } from '@tanstack/react-query'
import LiveBreathChart from '@/components/charts/LiveBreathChart'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

const LEVEL_RANGE: Record<number, { min: number; max: number }> = {
  1: { min: 100, max: 200 }, 2: { min: 150, max: 280 },
  3: { min: 220, max: 380 }, 4: { min: 300, max: 450 }, 5: { min: 400, max: 500 },
}

function formatTime(secs: number) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function Training() {
  const navigate = useNavigate()
  const { emitStart, emitEnd } = useTrainingSocket()
  const {
    sessionId, isActive, isPaused, elapsedSeconds, liveData,
    currentDpPa, currentPhase, cycleCount, avgPressure,
    pauseSession, resumeSession, reset, tickElapsed, level,
  } = useTrainingStore()

  const [selectedLevel, setSelectedLevel] = useState(3)
  const [isStarting, setIsStarting] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [showGlow, setShowGlow] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPhaseRef = useRef<string>('idle')

  // AI 추천 레벨 조회
  const { data: recData } = useQuery({
    queryKey: ['recommendation'],
    queryFn: analyticsApi.currentRecommendation,
  })

  // 기기 조회
  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: deviceApi.list,
  })
  const device = devicesData?.devices?.[0]

  // 타이머
  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(tickElapsed, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isActive, isPaused, tickElapsed])

  // 사이클 완료 글로우
  useEffect(() => {
    if (prevPhaseRef.current === 'exhale' && currentPhase === 'inhale') {
      setShowGlow(true)
      setTimeout(() => setShowGlow(false), 800)
    }
    prevPhaseRef.current = currentPhase
  }, [currentPhase])

  const handleStart = async () => {
    setIsStarting(true)
    try {
      emitStart(selectedLevel, 30)
      toast.success(`레벨 ${selectedLevel} 훈련을 시작합니다!`)
    } catch {
      toast.error('훈련 시작에 실패했습니다.')
    } finally {
      setIsStarting(false)
    }
  }

  const handleEnd = async () => {
    if (!sessionId) return
    setIsEnding(true)
    try {
      emitEnd()
      // REST 방식으로도 종료 처리
      const result = await sessionsApi.end(sessionId)
      reset()
      navigate(`/training/result/${result.session.id}`)
    } catch (err) {
      toast.error('세션 종료 중 오류가 발생했습니다.')
      reset()
      navigate('/dashboard')
    } finally {
      setIsEnding(false)
    }
  }

  const range = LEVEL_RANGE[isActive ? level : selectedLevel] ?? LEVEL_RANGE[3]

  // ─── 준비 화면 ───
  if (!isActive) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="card p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center mx-auto mb-4">
            <Play className="w-8 h-8 text-white" fill="white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">훈련 시작</h2>
          <p className="text-sm text-slate-500">저항 레벨을 선택하고 훈련을 시작하세요</p>
        </div>

        {/* 레벨 선택 */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-white">저항 레벨 선택</h3>
            {recData?.has_enough_data && (
              <span className="badge-info">
                AI 추천: 레벨 {recData.recommended_level}
              </span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(lv => {
              const r = LEVEL_RANGE[lv]
              const isRec = recData?.recommended_level === lv
              return (
                <motion.button
                  key={lv}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setSelectedLevel(lv)}
                  className={clsx(
                    'flex flex-col items-center py-3 rounded-xl border-2 transition-all text-sm font-bold',
                    selectedLevel === lv
                      ? 'border-primary-500 bg-primary-500/10 text-primary-600'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  )}
                >
                  {lv}
                  {isRec && <span className="text-[9px] text-primary-500 mt-0.5">추천</span>}
                  <span className={clsx(
                    'text-[10px] mt-1',
                    selectedLevel === lv ? 'text-primary-500' : 'text-slate-400'
                  )}>
                    {r.min}~{r.max}
                  </span>
                </motion.button>
              )
            })}
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">
            목표 차압 범위: <span className="text-primary-500 font-semibold">{range.min}~{range.max} Pa</span>
          </p>
        </div>

        {!device && (
          <div className="card p-4 border-warning-500/30 bg-warning-500/5 text-sm text-warning-500 text-center">
            ⚠️ 연결된 기기가 없습니다. 기기 연결 후 훈련하거나 Mock 시뮬레이터를 실행하세요.
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleStart}
          disabled={isStarting}
          className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
        >
          {isStarting ? <LoadingSpinner size="sm" /> : <Play size={18} fill="white" />}
          레벨 {selectedLevel} 훈련 시작
        </motion.button>
      </div>
    )
  }

  // ─── 훈련 화면 ───
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={clsx(
          'flex flex-col gap-4 h-full max-w-3xl mx-auto transition-all duration-300',
          showGlow && 'ring-4 ring-primary-500/30 rounded-2xl'
        )}
      >
        {/* 세션 정보 바 */}
        <div className="card px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-5 text-sm">
            <div className="text-center">
              <p className="text-xs text-slate-400">레벨</p>
              <p className="font-bold text-slate-900 dark:text-white">{level}</p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <p className="text-xs text-slate-400">경과시간</p>
              <p className="font-bold font-numeric text-primary-500">{formatTime(elapsedSeconds)}</p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <p className="text-xs text-slate-400">사이클</p>
              <p className="font-bold text-slate-900 dark:text-white">{cycleCount}회</p>
            </div>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={isPaused ? resumeSession : pauseSession}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleEnd}
              disabled={isEnding}
              className="w-9 h-9 rounded-xl bg-danger-500/10 flex items-center justify-center text-danger-500 hover:bg-danger-500/20"
            >
              {isEnding ? <LoadingSpinner size="sm" /> : <Square size={16} />}
            </motion.button>
          </div>
        </div>

        {/* 현재 수치 오버레이 */}
        <div className="card p-5 relative overflow-hidden">
          {/* 배경 글로우 */}
          {showGlow && (
            <motion.div
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 bg-primary-500/10 pointer-events-none"
            />
          )}

          <div className="flex items-center justify-between mb-3">
            <div>
              <span className={clsx(
                'text-7xl font-bold font-numeric leading-none',
                currentDpPa > 0 ? 'text-primary-500' : 'text-secondary-500'
              )}>
                {Math.abs(Math.round(currentDpPa))}
              </span>
              <span className="text-xl text-slate-400 ml-2">Pa</span>
            </div>
            <div className={clsx(
              'px-3 py-1.5 rounded-full text-sm font-semibold',
              currentPhase === 'inhale'
                ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400'
                : currentPhase === 'exhale'
                  ? 'bg-secondary-500/15 text-secondary-600 dark:text-secondary-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            )}>
              {currentPhase === 'inhale' ? '↑ 흡기' : currentPhase === 'exhale' ? '↓ 호기' : '대기'}
            </div>
          </div>

          {/* 라이브 차트 */}
          <div className="h-48">
            <LiveBreathChart
              data={liveData}
              minTarget={range.min}
              maxTarget={range.max}
            />
          </div>
        </div>

        {/* 하단 메트릭 패널 */}
        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            title="호흡 사이클"
            value={cycleCount}
            unit="회"
            info="흡기(들숨) → 호기(날숨) 1쌍을 1사이클로 계산합니다. 사이클이 많을수록 훈련량이 많음을 의미합니다."
            className="text-center"
          />
          <KpiCard
            title="평균 압력"
            value={avgPressure}
            unit="Pa"
            info="훈련 중 측정된 흡기 차압의 평균값입니다. 목표 범위 안에서 일정하게 유지될수록 좋은 훈련입니다."
            className="text-center"
          />
          <KpiCard
            title="목표 범위"
            value={`${range.min}~${range.max}`}
            unit="Pa"
            info="현재 레벨에서 권장되는 흡기 차압 범위입니다. 이 범위 안에서 꾸준히 호흡하는 것이 목표입니다."
            className="text-center"
          />
        </div>

        {isPaused && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-4 bg-warning-500/5 border-warning-500/30 text-center"
          >
            <p className="text-warning-500 font-semibold">⏸ 일시정지됨</p>
            <button onClick={resumeSession} className="btn-primary mt-3 px-8 py-2 text-sm">
              재개
            </button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
