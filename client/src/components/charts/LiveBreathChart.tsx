import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, ReferenceLine, Tooltip, Area, AreaChart,
} from 'recharts'
import type { MeasurementSample } from '@/types'

interface LiveBreathChartProps {
  data: MeasurementSample[]
  minTarget?: number
  maxTarget?: number
}

const WINDOW_SIZE = 300  // 화면에 표시할 포인트 수 (3초 @ 100Hz → 약 3초)

export default function LiveBreathChart({
  data, minTarget = 220, maxTarget = 380
}: LiveBreathChartProps) {

  // 최근 N개만 렌더링
  const chartData = useMemo(() => {
    const slice = data.length > WINDOW_SIZE ? data.slice(-WINDOW_SIZE) : data
    return slice.map((s, i) => ({
      idx: i,
      dp_pa: s.dp_pa,
      phase: s.phase,
    }))
  }, [data])

  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
          <defs>
            {/* 흡기 그라데이션 (양수) */}
            <linearGradient id="inhaleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.02} />
            </linearGradient>
            {/* 호기 그라데이션 (음수) */}
            <linearGradient id="exhaleGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(148,163,184,0.15)"
            vertical={false}
          />

          <XAxis dataKey="idx" hide />
          <YAxis
            domain={[-500, 500]}
            tickCount={5}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(v) => `${v}`}
            width={42}
          />

          <Tooltip
            contentStyle={{
              background: '#1e293b', border: 'none',
              borderRadius: '10px', fontSize: '12px', color: '#f1f5f9',
            }}
            formatter={(v: number) => [`${v.toFixed(1)} Pa`, '차압']}
            labelFormatter={() => ''}
          />

          {/* 기준선 */}
          <ReferenceLine y={0} stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />

          {/* 목표 범위 점선 */}
          <ReferenceLine
            y={maxTarget}
            stroke="#0EA5E9"
            strokeDasharray="6 3"
            strokeWidth={1.2}
            label={{ value: `목표 ${maxTarget}Pa`, position: 'right', fontSize: 10, fill: '#0EA5E9' }}
          />
          <ReferenceLine
            y={minTarget}
            stroke="#0EA5E9"
            strokeDasharray="6 3"
            strokeWidth={1.2}
            label={{ value: `${minTarget}Pa`, position: 'right', fontSize: 10, fill: '#0EA5E9' }}
          />

          {/* 파형 */}
          <Area
            type="monotone"
            dataKey="dp_pa"
            stroke="#0EA5E9"
            strokeWidth={2}
            fill="url(#inhaleGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
