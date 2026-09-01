import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { WOUI_LOGO_URL } from '../lib/constants'

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: signInError } = await signIn(email, password)
    setLoading(false)
    if (signInError) {
      setError('Email ou mot de passe incorrect.')
    } else {
      navigate('/dashboard')
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Renseignez votre email pour recevoir le lien de réinitialisation.')
      return
    }
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${import.meta.env.VITE_APP_URL}/login`,
    })
    if (resetError) setError(resetError.message)
    else setResetSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: '#050a14' }}>
      <div
        className="w-full max-w-[400px] rounded-[20px] p-8"
        style={{ background: '#0f172a', border: '1px solid #1e293b' }}
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src={WOUI_LOGO_URL} alt="Woui" className="h-12 w-12 rounded-xl" />
          <h1 className="font-display text-[1.5rem]" style={{ color: '#f1f5f9' }}>
            Espace praticien
          </h1>
          <p className="text-[0.82rem]" style={{ color: '#64748b' }}>
            Connectez-vous pour gérer vos consentements
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dr@cabinet.fr"
            required
            autoComplete="email"
          />
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />

          {error && (
            <div className="mb-4 rounded-lg p-3 text-[0.8rem]" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.18)' }}>
              {error}
            </div>
          )}
          {resetSent && (
            <div className="mb-4 rounded-lg p-3 text-[0.8rem]" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981', border: '1px solid rgba(16,185,129,0.18)' }}>
              Email de réinitialisation envoyé, vérifiez votre boîte de réception.
            </div>
          )}

          <Button type="submit" disabled={loading} className="mt-2 w-full justify-center">
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>

        <button
          onClick={handleForgotPassword}
          className="mt-4 w-full cursor-pointer bg-transparent text-center text-[0.8rem]"
          style={{ color: '#64748b', border: 'none' }}
        >
          Mot de passe oublié ?
        </button>
      </div>
    </div>
  )
}
