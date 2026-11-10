import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { WOUI_LOGO_URL } from '../lib/constants'

/**
 * Page atteinte depuis l'email « mot de passe oublié ». Supabase ouvre une session
 * de récupération à partir du lien ; on demande alors le nouveau mot de passe.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 10) {
      setError('Le mot de passe doit contenir au moins 10 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--surface-page)' }}>
      <div
        className="w-full max-w-[420px] p-[clamp(1.75rem,5vw,48px)]"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}
      >
        <div className="mb-9 flex flex-col items-center gap-4 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-[3px] p-[7px]" style={{ background: 'var(--action-accent)' }}>
            <img src={WOUI_LOGO_URL} alt="Woui" className="h-full w-full object-contain" />
          </div>
          <h1 className="font-display text-[1.75rem]" style={{ color: 'var(--text-primary)' }}>
            Nouveau mot de passe
          </h1>
          <p className="text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }}>
            {ready ? 'Choisissez votre nouveau mot de passe.' : 'Vérification du lien…'}
          </p>
        </div>

        {ready && (
          <form onSubmit={handleSubmit}>
            <Input
              label="Nouveau mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <Input
              label="Confirmer"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
            {error && (
              <div
                className="mb-4 p-3 text-[0.875rem]"
                style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 3 }}
              >
                {error}
              </div>
            )}
            <Button type="submit" variant="primary" disabled={loading} className="mt-2 w-full justify-center py-[14px] text-[1rem]">
              {loading ? 'Enregistrement…' : 'Enregistrer et me connecter'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
