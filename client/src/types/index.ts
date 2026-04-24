// ─── 공통 타입 정의 ───

export interface User {
  id: number
  email: string
  name: string
  birth_date?: string
  gender?: 'M' | 'F' | 'O'
  height_cm?: number
  weight_kg?: number
  is_smoker: boolean
  baseline_peak_pressure?: number
  target_daily_sessions: number
  created_at: string
}

export interface Device {
  id: number
  device_id: string
  user_id: number
  mac_address?: string
  firmware_version?: string
  last_seen?: string
  battery_percent?: number
  current_level: number
  is_online: boolean
}

export interface TrainingSession {
  id: number
  user_id: number
  device_id?: number
  started_at: string
  ended_at?: string
  duration_seconds: number
  level?: number
  total_cycles?: number
  avg_peak_pressure?: number
  max_pressure?: number
  min_pressure?: number
  score?: number
  notes?: string
  target_cycles: number
}

export interface MeasurementSample {
  ts_ms: number
  dp_pa: number
  phase?: 'inhale' | 'exhale' | 'idle'
}

// 분석 API 응답 타입
export interface TrendPoint {
  date: string
  session_count: number
  avg_score: number
  avg_peak_pressure: number
  total_duration_min: number
}

export interface WeeklyPoint {
  week: string
  count: number
}

export interface RadarData {
  inhale_power: number
  exhale_power: number
  endurance: number
  stability: number
  rhythm: number
}

export interface AnalyticsSummary {
  period: string
  total_sessions: number
  avg_score: number
  avg_peak_pressure: number
  total_training_min: number
  percentile: number
  trend: TrendPoint[]
  radar: RadarData
  weekly_chart: WeeklyPoint[]
}

export interface RecommendationReason {
  type: 'success' | 'warning' | 'info'
  text: string
}

export interface Recommendation {
  recommended_level: number
  current_level: number
  score_delta?: number
  reasons: RecommendationReason[]
  features: Record<string, number>
  has_enough_data: boolean
}
