import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from './ui/LoadingSpinner'

const FullscreenLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <LoadingSpinner size="md" />
  </div>
)

export const ProtectedRoute = () => {
  const { isAuthenticated, isOnboarded, loading } = useAuth()

  if (loading) {
    return <FullscreenLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  if (!isOnboarded) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
