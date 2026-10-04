import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { apiClient } from './services/api'
import { useAuthStore } from './store'
import { BottomNavigation } from './components/BottomNavigation'
import { CaptureMenu } from './components/CaptureMenu'
import './index.css'

// Lazy load pages
const HomePage = React.lazy(() => import('./pages/Home'))
const LoginPage = React.lazy(() => import('./pages/Login'))
const RegisterPage = React.lazy(() => import('./pages/Register'))
const TasksPage = React.lazy(() => import('./pages/Tasks'))
const TaskDetailPage = React.lazy(() => import('./pages/TaskDetail'))
const ProjectsPage = React.lazy(() => import('./pages/Projects'))
const ProjectDetailPage = React.lazy(() => import('./pages/ProjectDetail'))
const DashboardPage = React.lazy(() => import('./pages/Dashboard'))
const InboxPage = React.lazy(() => import('./pages/Inbox'))
const AIPage = React.lazy(() => import('./pages/AI'))
const ProfilePage = React.lazy(() => import('./pages/Profile'))
const AmbientAIPage = React.lazy(() => import('./pages/AmbientAI'))
const OfficeKitCompanion = React.lazy(() => import('./pages/OfficeKitCompanion'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const setUser = useAuthStore((state) => state.setUser)
  const setIsLoading = useAuthStore((state) => state.setIsLoading)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    apiClient
      .getProfile()
      .then((response) => {
        const profileUser = response?.data?.data?.user ?? response?.data?.user ?? null
        setUser(profileUser)
      })
      .catch(() => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [setUser, setIsLoading])

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="flex h-screen w-screen bg-gray-50">
          {isAuthenticated && <BottomNavigation />}
          <main className="flex-1 overflow-auto">
            <React.Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <HomePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tasks"
                  element={
                    <ProtectedRoute>
                      <TasksPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tasks/:id"
                  element={
                    <ProtectedRoute>
                      <TaskDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <ProtectedRoute>
                      <ProjectsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects/:id"
                  element={
                    <ProtectedRoute>
                      <ProjectDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inbox"
                  element={
                    <ProtectedRoute>
                      <InboxPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ai"
                  element={
                    <ProtectedRoute>
                      <AIPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ambient"
                  element={
                    <ProtectedRoute>
                      <AmbientAIPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/office-kit"
                  element={
                    <ProtectedRoute>
                      <OfficeKitCompanion />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/laptop"
                  element={
                    <ProtectedRoute>
                      <OfficeKitCompanion />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </React.Suspense>
          </main>
          {isAuthenticated && <CaptureMenu />}
        </div>
      </Router>
    </QueryClientProvider>
  )
}
