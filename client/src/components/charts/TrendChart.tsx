import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Area, AreaChart, Legend,
} from 'recharts'
import type { TrendPoint } from '@/types'

interface TrendChartProps {
  data: TrendPoint[]
  metric?: 'avg_score' | 'avg_peak_pressure'
}

export default function TrendChart({ data, metric = 'avg_score' }: TrendChartProps) {
  const isScore = metric === 'avg_score'
  const color = isScore ? '#0EA5E9' : '#22C55E'
  const label = isScore ? '훈련 점수' : '평균 흡기압 (Pa)'

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickFormatter={(v: string) => v.slice(5)} // MM-DD
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          domain={isScore ? [0, 100] : ['auto', 'auto']}
          tickLine={false}
          axisLine={false}
          width={38}
        />
        <Tooltip
          contentStyle={{
            background: '#1e293b', border: 'none',
            borderRadius: '10px', fontSize: '12px', color: '#f1f5f9',
          }}
          formatter={(v: number) => [
            isScore ? `${v}점` : `${v} Pa`,
            label,
          ]}
        />
        <Area
          type="monotone"
          dataKey={metric}
          stroke={color}
          strokeWidth={2.5}
          fill="url(#trendGrad)"
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
