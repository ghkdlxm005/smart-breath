import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import Layout from '@/components/layout/Layout'

// 페이지
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Training from '@/pages/Training'
import TrainingResult from '@/pages/TrainingResult'
import Analytics from '@/pages/Analytics'
import Recommendation from '@/pages/Recommendation'
import History from '@/pages/History'
import Device from '@/pages/Device'
import Profile from '@/pages/Profile'

/** 인증된 사용자만 접근 가능한 라우트 */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 공개 라우트 */}
        <Route path="/login" element={<Login />} />

        {/* 인증 필요 라우트 */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"          element={<Dashboard />} />
          <Route path="training"           element={<Training />} />
          <Route path="training/result/:id" element={<TrainingResult />} />
          <Route path="analytics"          element={<Analytics />} />
          <Route path="recommendation"     element={<Recommendation />} />
          <Route path="history"            element={<History />} />
          <Route path="device"             element={<Device />} />
          <Route path="profile"            element={<Profile />} />
        </Route>

        {/* 404 → 대시보드 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
