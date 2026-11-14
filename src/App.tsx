import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { Preloader } from './components/ui/Preloader'

// Chaque écran est chargé à la demande : la page patient ne télécharge pas le tableau de bord.
const AppLayout = lazy(() => import('./components/layout/AppLayout').then((m) => ({ default: m.AppLayout })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const SignaturePage = lazy(() => import('./pages/SignaturePage').then((m) => ({ default: m.SignaturePage })))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))
const SignupPage = lazy(() => import('./pages/SignupPage').then((m) => ({ default: m.SignupPage })))
const ProfilesPage = lazy(() => import('./pages/ProfilesPage').then((m) => ({ default: m.ProfilesPage })))
const PatientPage = lazy(() => import('./pages/PatientPage').then((m) => ({ default: m.PatientPage })))

export default function App() {
  const { user, doctor, loading, signOut, refetchDoctor } = useAuth()

  return (
    <Suspense fallback={<Preloader label="Chargement…" />}>
    <Routes>
      {/* Public — accès patient via token, aucune authentification */}
      <Route path="/sign/:token" element={<SignaturePage />} />

      {/* Public — définition d'un nouveau mot de passe (lien email) */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Public — inscription praticien (essai gratuit) */}
      <Route
        path="/signup"
        element={loading ? <FullScreenSpinner /> : user ? <Navigate to="/dashboard" replace /> : <SignupPage />}
      />

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
            <AppLayout doctor={doctor} authLoading={loading} onSignOut={signOut} refetchDoctor={refetchDoctor} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/patients/:id" element={<PatientPage />} />
      </Route>

      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
    </Suspense>
  )
}

function FullScreenSpinner() {
  return <Preloader />
}
