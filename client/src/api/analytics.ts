import { api } from './client'
import type { AnalyticsSummary, Recommendation } from '@/types'

export const analyticsApi = {
  summary: (period: '7d' | '30d' | '90d' | '180d' = '7d') =>
    api.get<AnalyticsSummary>(`/api/analytics/summary?period=${period}`),
  currentRecommendation: () =>
    api.get<Recommendation>('/api/recommendation/current'),
  applyRecommendation: (level: number) =>
    api.post('/api/recommendation/apply', { level }),
}
