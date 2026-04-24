import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* 데스크톱 사이드바 */}
      <Sidebar />

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* 모바일 하단 탭바 */}
      <BottomNav />
    </div>
  )
}
