import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { supabase } from '../../lib/supabase'
import { documentUrl, imageToPng } from '../../lib/documents'
import type { Doctor } from '../../types'

interface CabinetIdentityProps {
  /** Gestion du cabinet : le champ s'intitule « Établissement ». */
  establishment?: boolean
  doctor: Doctor
  refetchDoctor: () => Promise<void>
  showToast: (msg: string, type?: 'success' | 'warning') => void
  onSeePlans: () => void
}

/**
 * Identité du cabinet affichée au patient (page de signature, e-mail, PDF signé).
 * Nom : toutes les offres. Logo : offre Clinique.
 */
export function CabinetIdentity({ doctor, refetchDoctor, showToast, onSeePlans, establishment = false }: CabinetIdentityProps) {
  const [name, setName] = useState(doctor.cabinet_name ?? '')
  const [saving, setSaving] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const logoEnabled = doctor.plan === 'clinic'

  useEffect(() => {
    let cancelled = false
    if (!doctor.logo_path) {
      setLogoUrl(null)
      return
    }
    void documentUrl(doctor.logo_path).then((url) => !cancelled && setLogoUrl(url))
    return () => {
      cancelled = true
    }
  }, [doctor.logo_path])

  const saveName = async () => {
    setSaving(true)
    const value = name.trim().slice(0, 120)
    const { error } = await supabase
      .from('doctors')
      .update({ cabinet_name: value || null, updated_at: new Date().toISOString() })
      .eq('id', doctor.id)
    if (!error) await refetchDoctor()
    setSaving(false)
    showToast(error ? 'Le nom n’a pas pu être enregistré.' : 'Nom du cabinet enregistré', error ? 'warning' : 'success')
  }

  const setLogo = async (file: File | null) => {
    setLogoBusy(true)
    let path: string | null = null
    if (file) {
      if (!file.type.startsWith('image/')) {
        setLogoBusy(false)
        showToast('Choisissez une image (PNG, JPG ou SVG).', 'warning')
        return
      }
      try {
        const png = await imageToPng(file)
        path = `${doctor.id}/logo/${Date.now()}.png`
        const { error } = await supabase.storage.from('documents').upload(path, png, { contentType: 'image/png', upsert: false })
        if (error) throw error
      } catch {
        setLogoBusy(false)
        showToast('Le logo n’a pas pu être enregistré. Réessayez.', 'warning')
        return
      }
    }
    const previous = doctor.logo_path
    const { error } = await supabase
      .from('doctors')
      .update({ logo_path: path, updated_at: new Date().toISOString() })
      .eq('id', doctor.id)
    if (!error && previous) await supabase.storage.from('documents').remove([previous])
    await refetchDoctor()
    setLogoBusy(false)
    showToast(error ? 'Le logo n’a pas pu être enregistré.' : file ? 'Logo enregistré' : 'Logo retiré', error ? 'warning' : 'success')
  }

  return (
    <div className="mt-9 max-w-[700px] pt-7" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <h3 className="font-display text-[18px]" style={{ color: 'var(--text-primary)' }}>
        {establishment ? 'Établissement' : 'Cabinet'}
      </h3>
      <p className="mb-4 mt-[6px] text-[0.875rem]" style={{ color: 'var(--text-secondary)' }}>
        Le nom de votre cabinet apparaît sur la page du patient, dans l’e-mail et sur les documents signés.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-[380px] [&>label]:mb-0">
          <Input label={establishment ? 'Établissement' : 'Nom du cabinet'} value={name} onChange={(e) => setName(e.target.value)} placeholder="Cabinet dentaire des Lilas" maxLength={120} />
        </div>
        <Button variant="ghost" onClick={saveName} disabled={saving || name.trim() === (doctor.cabinet_name ?? '')}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-5">
        <div
          className="flex h-[64px] w-[140px] items-center justify-center overflow-hidden"
          style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 4, opacity: logoEnabled ? 1 : 0.5 }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo du cabinet" className="max-h-[52px] max-w-[124px] object-contain" />
          ) : (
            <span className="text-[12px]" style={{ color: '#6b6b6b' }}>
              Votre logo
            </span>
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9375rem] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Logo du cabinet
            </span>
            {!logoEnabled && (
              <span
                className="font-mono rounded-[3px] px-2 py-[3px] text-[10px] uppercase tracking-[0.1em]"
                style={{ background: 'var(--surface-card-alt)', color: 'var(--text-accent)' }}
              >
                Abonnement Clinique
              </span>
            )}
          </div>
          <p className="mb-3 mt-1 text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>
            {logoEnabled ? 'PNG, JPG ou SVG, fond clair de préférence.' : 'Votre logo sur la page patient, les e-mails et les PDF signés.'}
          </p>
          {logoEnabled ? (
            <div className="flex flex-wrap gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  e.target.value = ''
                  if (file) void setLogo(file)
                }}
              />
              <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={logoBusy}>
                {logoBusy ? 'Envoi…' : doctor.logo_path ? 'Changer le logo' : 'Ajouter un logo'}
              </Button>
              {doctor.logo_path && (
                <Button variant="ghost" onClick={() => void setLogo(null)} disabled={logoBusy}>
                  Retirer
                </Button>
              )}
            </div>
          ) : (
            <Button variant="ghost" onClick={onSeePlans}>
              Voir l'offre Clinique
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
