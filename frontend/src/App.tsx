import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, lazy } from 'react'
import { ErrorBoundary } from '@/components/error-boundary'
import { AppLayout } from '@/components/layout/app-layout'
import { AuthGuard, GuestGuard } from '@/components/auth/auth-guard'
import { ToastContainer } from '@/components/ui/toast'
import { PageLoader } from '@/components/ui/spinner'

// Lazy-loaded pages for code splitting
const LoginPage = lazy(() => import('@/pages/login').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/register').then(m => ({ default: m.RegisterPage })))
const ChatPage = lazy(() => import('@/pages/chat').then(m => ({ default: m.ChatPage })))
const DocumentsPage = lazy(() => import('@/pages/documents').then(m => ({ default: m.DocumentsPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })))
const AdminUsersPage = lazy(() => import('@/pages/admin-users').then(m => ({ default: m.AdminUsersPage })))
const HistoryPage = lazy(() => import('@/pages/history').then(m => ({ default: m.HistoryPage })))
const LandingPage = lazy(() => import('@/pages/landing').then(m => ({ default: m.LandingPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
})


const PageFallback = () => <PageLoader />

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Marketing landing page - outside guards */}
              <Route path="/" element={<LandingPage />} />

              {/* Public routes */}
              <Route element={<GuestGuard />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>

              {/* Protected routes */}
              <Route element={<AuthGuard />}>
                <Route element={<AppLayout />}>
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/documents" element={<DocumentsPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                </Route>
              </Route>

              {/* Default redirect - send unmatched routes to landing */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <ToastContainer />
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
