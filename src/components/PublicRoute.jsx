import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from './ui/LoadingSpinner'

const FullscreenLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <LoadingSpinner size="md" />
  </div>
)

export const PublicRoute = () => {
  const { isAuthenticated, isEmailVerified, isOnboarded, loading } = useAuth()

  if (loading) {
    return <FullscreenLoader />
  }

  if (isAuthenticated) {
    if (!isEmailVerified) {
      return <Navigate to="/verify-email" replace />
    }
    if (isOnboarded) {
      return <Navigate to="/dashboard" replace />
    }
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
