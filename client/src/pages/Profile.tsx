import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Bell, Shield, Trash2, Save, Target } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUpdateProfile, useLogout } from '@/hooks/useAuth'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function Profile() {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  const { mutate: updateProfile, isPending } = useUpdateProfile()
  const { mutate: logout } = useLogout()

  const [form, setForm] = useState({
    name: user?.name ?? '',
    height_cm: user?.height_cm ?? '',
    weight_kg: user?.weight_kg ?? '',
    is_smoker: user?.is_smoker ?? false,
    target_daily_sessions: user?.target_daily_sessions ?? 3,
    newPassword: '',
  })
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { mutate: deleteAccount, isPending: deleting } = useMutation({
    mutationFn: authApi.deleteAccount,
    onSuccess: () => {
      setUser(null)
      navigate('/login')
      toast.success('계정이 삭제되었습니다.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      name: form.name,
      height_cm: form.height_cm ? Number(form.height_cm) : undefined,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
      is_smoker: form.is_smoker,
      target_daily_sessions: Number(form.target_daily_sessions),
    }
    if (form.newPassword) payload.password = form.newPassword
    updateProfile(payload as any)
  }

  return (
    <div className="space-y-5 max-w-lg">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">프로필 & 설정</h2>

      {/* 기본 정보 */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User size={16} className="text-primary-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">기본 정보</h3>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">이름</label>
          <input type="text" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="input-field" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">이메일</label>
          <input type="email" value={user?.email ?? ''} disabled
            className="input-field opacity-60 cursor-not-allowed" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">키 (cm)</label>
            <input type="number" value={form.height_cm}
              onChange={e => setForm(f => ({ ...f, height_cm: e.target.value as any }))}
              className="input-field" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">체중 (kg)</label>
            <input type="number" value={form.weight_kg}
              onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value as any }))}
              className="input-field" />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_smoker}
            onChange={e => setForm(f => ({ ...f, is_smoker: e.target.checked }))}
            className="w-4 h-4 rounded accent-primary-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">흡연자입니다</span>
        </label>
      </div>

      {/* 목표 설정 */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Target size={16} className="text-accent-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">훈련 목표</h3>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            일일 목표 훈련 횟수: <span className="text-primary-500 font-bold">{form.target_daily_sessions}회</span>
          </label>
          <input
            type="range" min={1} max={10} step={1}
            value={form.target_daily_sessions}
            onChange={e => setForm(f => ({ ...f, target_daily_sessions: Number(e.target.value) }))}
            className="w-full accent-primary-500"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>1회</span><span>10회</span>
          </div>
        </div>
      </div>

      {/* 비밀번호 변경 */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-secondary-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">비밀번호 변경</h3>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">새 비밀번호 (변경 시에만 입력)</label>
          <input type="password" value={form.newPassword} placeholder="새 비밀번호"
            onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
            className="input-field" />
        </div>
      </div>

      {/* 저장 버튼 */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        disabled={isPending}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <Save size={16} />
        {isPending ? '저장 중...' : '변경사항 저장'}
      </motion.button>

      {/* 계정 삭제 */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trash2 size={16} className="text-danger-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">계정 삭제</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          계정을 삭제하면 모든 훈련 데이터가 영구적으로 삭제됩니다.
        </p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="text-sm text-danger-500 hover:underline">
            계정 삭제하기
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => deleteAccount()}
              disabled={deleting}
              className="flex-1 py-2 rounded-xl bg-danger-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleting ? '삭제 중...' : '정말 삭제합니다'}
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="btn-secondary px-4 text-sm">
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
