import {
  ResponsiveContainer, RadarChart as RechartsRadar,
  PolarGrid, PolarAngleAxis, Radar, Tooltip,
} from 'recharts'
import type { RadarData } from '@/types'

interface RadarChartProps { data: RadarData }

const LABELS: Record<keyof RadarData, string> = {
  inhale_power: '흡기력',
  exhale_power: '호기력',
  endurance:    '지속력',
  stability:    '안정성',
  rhythm:       '리듬',
}

export default function RadarChart({ data }: RadarChartProps) {
  const chartData = (Object.keys(data) as (keyof RadarData)[]).map((key) => ({
    subject: LABELS[key],
    value: data[key],
    fullMark: 100,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsRadar data={chartData} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="rgba(148,163,184,0.2)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 12, fill: '#64748b' }}
        />
        <Tooltip
          contentStyle={{
            background: '#1e293b', border: 'none',
            borderRadius: '10px', fontSize: '12px', color: '#f1f5f9',
          }}
          formatter={(v: number) => [`${v.toFixed(0)}점`]}
        />
        <Radar
          name="능력치"
          dataKey="value"
          stroke="#0EA5E9"
          fill="#0EA5E9"
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </RechartsRadar>
    </ResponsiveContainer>
  )
}
