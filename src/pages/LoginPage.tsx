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
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--surface-page)' }}>
      <div
        className="w-full max-w-[420px] p-[clamp(1.75rem,5vw,48px)]"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
      >
        <div className="mb-9 flex flex-col items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-[3px] p-[7px]" style={{ background: 'var(--action-accent)' }}>
            <img src={WOUI_LOGO_URL} alt="Woui" className="h-full w-full object-contain" />
          </div>
          <h1 className="font-display text-[1.75rem]" style={{ color: 'var(--text-primary)' }}>
            Espace praticien
          </h1>
          <p className="text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
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
            <div
              className="mb-4 p-3 text-[0.875rem]"
              style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 3 }}
            >
              {error}
            </div>
          )}
          {resetSent && (
            <div
              className="mb-4 p-3 text-[0.875rem]"
              style={{ background: 'var(--mint-soft)', border: '1px solid rgba(63,199,154,0.3)', color: '#065f46', borderRadius: 3 }}
            >
              Email de réinitialisation envoyé, vérifiez votre boîte de réception.
            </div>
          )}

          <Button type="submit" variant="primary" disabled={loading} className="mt-2 w-full justify-center py-[14px] text-[1rem]">
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>

        <button
          onClick={handleForgotPassword}
          className="mt-4 w-full cursor-pointer text-center text-[13px]"
          style={{ background: 'none', border: 'none', color: 'var(--text-accent)' }}
        >
          Mot de passe oublié ?
        </button>
      </div>
    </div>
  )
}
