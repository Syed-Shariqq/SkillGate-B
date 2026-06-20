import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from './ui/LoadingSpinner'

const FullscreenLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <LoadingSpinner size="md" />
  </div>
)

export const ProtectedRoute = () => {
  const { isAuthenticated, isEmailVerified, isOnboarded, isPendingApproval, isRejected, loading } = useAuth()

  if (loading) {
    return <FullscreenLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  if (!isEmailVerified) {
    return <Navigate to="/verify-email" replace />
  }

  if (!isOnboarded) {
    return <Navigate to="/onboarding" replace />
  }

  if (isPendingApproval) {
    return <Navigate to="/pending-approval" replace />
  }

  if (isRejected) {
    return <Navigate to="/rejected" replace />
  }

  return <Outlet />
}
