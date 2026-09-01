import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { SignaturePage } from './pages/SignaturePage'
import { Spinner } from './components/ui/Spinner'

export default function App() {
  const { user, doctor, loading, signOut } = useAuth()

  return (
    <Routes>
      {/* Public — accès patient via token, aucune authentification */}
      <Route path="/sign/:token" element={<SignaturePage />} />

      {/* Public — login praticien */}
      <Route
        path="/login"
        element={
          loading ? (
            <FullScreenSpinner />
          ) : user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage />
          )
        }
      />

      {/* Privé — praticien authentifié */}
      <Route
        element={
          loading ? (
            <FullScreenSpinner />
          ) : user ? (
            <AppLayout doctor={doctor} authLoading={loading} onSignOut={signOut} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#050a14' }}>
      <Spinner />
    </div>
  )
}
