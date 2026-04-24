import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Smartphone, Plus, Trash2, Wifi, WifiOff, Battery, Zap } from 'lucide-react'
import { deviceApi } from '@/api/device'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import type { Device } from '@/types'

const LEVEL_LABELS = ['', '매우 낮음', '낮음', '중간', '높음', '최고']

function BatteryIcon({ percent }: { percent?: number }) {
  if (!percent) return null
  const color = percent >= 50 ? 'text-accent-500' : percent >= 20 ? 'text-warning-500' : 'text-danger-500'
  return (
    <span className={clsx('flex items-center gap-1 text-xs', color)}>
      <Battery size={12} /> {percent}%
    </span>
  )
}

function DeviceCard({ device, onRemove }: { device: Device; onRemove: (id: number) => void }) {
  const [testLevel, setTestLevel] = useState(device.current_level)
  const qc = useQueryClient()

  const { mutate: test, isPending } = useMutation({
    mutationFn: (level: number) => deviceApi.test(device.id, level),
    onSuccess: () => {
      toast.success(`레벨 ${testLevel} 서보 테스트 완료`)
      qc.invalidateQueries({ queryKey: ['devices'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <motion.div whileHover={{ y: -2 }} className="card p-5 space-y-4">
      {/* 기기 헤더 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            device.is_online ? 'bg-accent-500/10' : 'bg-slate-100 dark:bg-slate-800'
          )}>
            <Smartphone size={20} className={device.is_online ? 'text-accent-500' : 'text-slate-400'} />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white text-sm">{device.device_id}</p>
            <p className="text-xs text-slate-400">{device.mac_address ?? 'MAC 미등록'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            device.is_online
              ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          )}>
            {device.is_online ? <Wifi size={11} /> : <WifiOff size={11} />}
            {device.is_online ? 'Online' : 'Offline'}
          </span>
          <button
            onClick={() => onRemove(device.id)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-danger-500 hover:bg-danger-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 상태 정보 */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <BatteryIcon percent={device.battery_percent} />
        <span>펌웨어 {device.firmware_version ?? '-'}</span>
        <span>현재 레벨 {device.current_level}</span>
      </div>

      {/* 서보 테스트 */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
        <p className="text-xs font-medium text-slate-500 mb-2">수동 서보 테스트</p>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(lv => (
              <button key={lv}
                onClick={() => setTestLevel(lv)}
                className={clsx(
                  'w-8 h-8 rounded-lg text-xs font-bold transition-all',
                  testLevel === lv
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                )}>
                {lv}
              </button>
            ))}
          </div>
          <button
            onClick={() => test(testLevel)}
            disabled={isPending || !device.is_online}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs ml-auto disabled:opacity-50"
          >
            {isPending ? <LoadingSpinner size="sm" /> : <Zap size={12} />}
            적용
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">{LEVEL_LABELS[testLevel]} 강도</p>
      </div>
    </motion.div>
  )
}

export default function DevicePage() {
  const qc = useQueryClient()
  const [showPair, setShowPair] = useState(false)
  const [newDeviceId, setNewDeviceId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: deviceApi.list,
  })

  const { mutate: pair, isPending: pairing } = useMutation({
    mutationFn: () => deviceApi.pair(newDeviceId.trim()),
    onSuccess: () => {
      toast.success(`${newDeviceId} 페어링 완료!`)
      qc.invalidateQueries({ queryKey: ['devices'] })
      setNewDeviceId('')
      setShowPair(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const { mutate: remove } = useMutation({
    mutationFn: deviceApi.remove,
    onSuccess: () => {
      toast.success('기기가 제거되었습니다.')
      qc.invalidateQueries({ queryKey: ['devices'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">기기 관리</h2>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowPair(v => !v)}
          className="btn-primary flex items-center gap-2 text-sm py-2"
        >
          <Plus size={15} /> 기기 추가
        </motion.button>
      </div>

      {/* 페어링 폼 */}
      {showPair && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="card p-5 space-y-3"
        >
          <p className="text-sm font-semibold text-slate-800 dark:text-white">새 기기 연결</p>
          <input
            type="text"
            placeholder="기기 ID 입력 (예: esp32_01)"
            value={newDeviceId}
            onChange={e => setNewDeviceId(e.target.value)}
            className="input-field"
          />
          <p className="text-xs text-slate-400">
            ESP32 기기의 고유 ID를 입력하거나, Mock 시뮬레이터 실행 시 <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">esp32_demo</code>를 입력하세요.
          </p>
          <button
            onClick={() => pair()}
            disabled={pairing || !newDeviceId.trim()}
            className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {pairing ? <LoadingSpinner size="sm" /> : null}
            연결하기
          </button>
        </motion.div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : !data?.devices.length ? (
        <EmptyState
          icon={Smartphone}
          title="연결된 기기 없음"
          description="ESP32 기기를 페어링하면 실시간 훈련이 가능합니다."
        />
      ) : (
        <div className="space-y-4">
          {data.devices.map(d => (
            <DeviceCard key={d.id} device={d} onRemove={(id) => remove(id)} />
          ))}
        </div>
      )}
    </div>
  )
}
