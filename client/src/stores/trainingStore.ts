import { create } from 'zustand'
import type { MeasurementSample } from '@/types'

/** 실시간 훈련 세션 상태 */
interface TrainingState {
  sessionId: number | null
  level: number
  isActive: boolean
  isPaused: boolean
  elapsedSeconds: number
  currentSet: number
  totalSets: number
  targetCycles: number

  // 실시간 데이터 (슬라이딩 윈도우 30초)
  liveData: MeasurementSample[]
  currentDpPa: number
  currentPhase: 'inhale' | 'exhale' | 'idle'
  lastDefinitePhase: 'inhale' | 'exhale' | 'idle'  // idle 제외한 마지막 확정 페이즈
  cycleCount: number
  avgPressure: number
  sessionScore: number

  // 액션
  startSession: (sessionId: number, level: number, targetCycles?: number) => void
  endSession: () => void
  pauseSession: () => void
  resumeSession: () => void
  addSample: (sample: MeasurementSample) => void
  tickElapsed: () => void
  reset: () => void
}

const MAX_LIVE_POINTS = 3000  // 30초 × 100Hz

export const useTrainingStore = create<TrainingState>((set, get) => ({
  sessionId: null,
  level: 3,
  isActive: false,
  isPaused: false,
  elapsedSeconds: 0,
  currentSet: 1,
  totalSets: 5,
  targetCycles: 30,

  liveData: [],
  currentDpPa: 0,
  currentPhase: 'idle',
  lastDefinitePhase: 'idle',
  cycleCount: 0,
  avgPressure: 0,
  sessionScore: 0,

  startSession: (sessionId, level, targetCycles = 30) =>
    set({
      sessionId, level, isActive: true, isPaused: false,
      elapsedSeconds: 0, cycleCount: 0, avgPressure: 0,
      sessionScore: 0, liveData: [], currentDpPa: 0,
      currentPhase: 'idle', lastDefinitePhase: 'idle', targetCycles,
    }),

  endSession: () => set({ isActive: false }),

  pauseSession: () => set({ isPaused: true }),
  resumeSession: () => set({ isPaused: false }),

  addSample: (sample) => {
    const state = get()
    // 슬라이딩 윈도우 유지
    const next = [...state.liveData, sample]
    const windowed = next.length > MAX_LIVE_POINTS
      ? next.slice(next.length - MAX_LIVE_POINTS)
      : next

    // 평균 흡기압 계산
    const inhaleSamples = windowed.filter(s => s.dp_pa > 20)
    const avgPressure = inhaleSamples.length > 0
      ? inhaleSamples.reduce((a, b) => a + b.dp_pa, 0) / inhaleSamples.length
      : state.avgPressure

    // 사이클 카운트 (호기→흡기 전환 감지)
    // idle 구간(0 근처)을 건너뛰고 "마지막 확정 페이즈"로 비교
    let cycleCount = state.cycleCount
    let lastDefinitePhase = state.lastDefinitePhase
    const newPhase = sample.phase ?? 'idle'

    if (newPhase !== 'idle') {
      // idle이 아닐 때만 확정 페이즈 갱신 + 전환 감지
      if (lastDefinitePhase === 'exhale' && newPhase === 'inhale') {
        cycleCount += 1
      }
      lastDefinitePhase = newPhase
    }

    set({
      liveData: windowed,
      currentDpPa: sample.dp_pa,
      currentPhase: newPhase,
      lastDefinitePhase,
      avgPressure: Math.round(avgPressure),
      cycleCount,
    })
  },

  tickElapsed: () =>
    set((s) => ({ elapsedSeconds: s.isPaused ? s.elapsedSeconds : s.elapsedSeconds + 1 })),

  reset: () =>
    set({
      sessionId: null, isActive: false, isPaused: false,
      elapsedSeconds: 0, cycleCount: 0, avgPressure: 0,
      sessionScore: 0, liveData: [], currentDpPa: 0,
      currentPhase: 'idle', lastDefinitePhase: 'idle',
    }),
}))
