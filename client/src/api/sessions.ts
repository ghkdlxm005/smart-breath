import { api } from './client'
import type { TrainingSession, MeasurementSample } from '@/types'

export const sessionsApi = {
  start: (level: number, target_cycles = 30) =>
    api.post<{ session: TrainingSession }>('/api/sessions/start', { level, target_cycles }),
  end: (id: number) =>
    api.post<{ session: TrainingSession }>(`/api/sessions/${id}/end`),
  list: (params?: { page?: number; per_page?: number; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.page)     qs.set('page', String(params.page))
    if (params?.per_page) qs.set('per_page', String(params.per_page))
    if (params?.from)     qs.set('from', params.from)
    if (params?.to)       qs.set('to', params.to)
    return api.get<{ sessions: TrainingSession[]; total: number; pages: number }>(
      `/api/sessions?${qs}`
    )
  },
  get: (id: number) =>
    api.get<{ session: TrainingSession }>(`/api/sessions/${id}`),
  samples: (id: number, maxPoints = 2000) =>
    api.get<{ samples: MeasurementSample[]; total_raw_samples: number }>(
      `/api/sessions/${id}/samples?max_points=${maxPoints}`
    ),
}
