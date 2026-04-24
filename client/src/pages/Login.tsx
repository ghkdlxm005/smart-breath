import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Wind, Eye, EyeOff, Mail, Lock, User, Ruler, Weight } from 'lucide-react'
import { useLogin, useSignup } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'

export default function Login() {
  const { user } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [showPw, setShowPw] = useState(false)

  // 로그인 폼
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  // 회원가입 폼
  const [signupForm, setSignupForm] = useState({
    email: '', password: '', name: '',
    gender: 'M', height_cm: '', weight_kg: '',
    is_smoker: false,
  })

  const { mutate: login, isPending: loggingIn } = useLogin()
  const { mutate: signup, isPending: signingUp } = useSignup()

  if (user) return <Navigate to="/dashboard" replace />

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    login(loginForm)
  }

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    signup({
      ...signupForm,
      height_cm: signupForm.height_cm ? Number(signupForm.height_cm) : undefined,
      weight_kg: signupForm.weight_kg ? Number(signupForm.weight_kg) : undefined,
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Wind className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">스마트 호흡 훈련기</h1>
          <p className="text-sm text-slate-500 mt-1">개인 맞춤 호흡근 훈련 시스템</p>
        </div>

        {/* 탭 */}
        <div className="card p-1 flex mb-6">
          {(['login', 'signup'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMode(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                mode === tab
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {mode === 'login' ? (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleLogin}
              className="card p-6 space-y-4"
            >
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email" required placeholder="이메일"
                  value={loginForm.email}
                  onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                  className="input-field pl-10"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPw ? 'text' : 'password'} required placeholder="비밀번호"
                  value={loginForm.password}
                  onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                  className="input-field pl-10 pr-10"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* 데모 계정 힌트 */}
              <p className="text-xs text-slate-400 text-center">
                데모: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-primary-500">demo@smartbreath.local</code> / <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">demo1234</code>
              </p>

              <button type="submit" disabled={loggingIn} className="btn-primary w-full mt-2">
                {loggingIn ? '로그인 중...' : '로그인'}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="signup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSignup}
              className="card p-6 space-y-4"
            >
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" required placeholder="이름"
                  value={signupForm.name}
                  onChange={e => setSignupForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field pl-10" />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="email" required placeholder="이메일"
                  value={signupForm.email}
                  onChange={e => setSignupForm(f => ({ ...f, email: e.target.value }))}
                  className="input-field pl-10" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={showPw ? 'text' : 'password'} required placeholder="비밀번호 (6자 이상)"
                  minLength={6}
                  value={signupForm.password}
                  onChange={e => setSignupForm(f => ({ ...f, password: e.target.value }))}
                  className="input-field pl-10 pr-10" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* 성별 */}
              <div className="flex gap-2">
                {(['M', 'F', 'O'] as const).map(g => (
                  <button key={g} type="button"
                    onClick={() => setSignupForm(f => ({ ...f, gender: g }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      signupForm.gender === g
                        ? 'border-primary-500 bg-primary-500/10 text-primary-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}>
                    {g === 'M' ? '남성' : g === 'F' ? '여성' : '기타'}
                  </button>
                ))}
              </div>

              {/* 신체 정보 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="number" placeholder="키 (cm)" min={100} max={250}
                    value={signupForm.height_cm}
                    onChange={e => setSignupForm(f => ({ ...f, height_cm: e.target.value }))}
                    className="input-field pl-10" />
                </div>
                <div className="relative">
                  <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="number" placeholder="체중 (kg)" min={20} max={300}
                    value={signupForm.weight_kg}
                    onChange={e => setSignupForm(f => ({ ...f, weight_kg: e.target.value }))}
                    className="input-field pl-10" />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox"
                  checked={signupForm.is_smoker}
                  onChange={e => setSignupForm(f => ({ ...f, is_smoker: e.target.checked }))}
                  className="w-4 h-4 rounded accent-primary-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">흡연자입니다</span>
              </label>

              <button type="submit" disabled={signingUp} className="btn-primary w-full">
                {signingUp ? '처리 중...' : '회원가입'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
