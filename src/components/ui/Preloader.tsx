import { WOUI_LOGO_URL } from '../../lib/constants'

/** Écran de chargement plein écran (connexion, ouverture de l'espace praticien). */
export function Preloader({ label = 'Chargement de votre espace…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6"
      style={{ background: 'var(--surface-page)' }}
      role="status"
      aria-live="polite"
    >
      <div className="woui-preloader-mark flex h-14 w-14 items-center justify-center rounded-[10px] p-3" style={{ background: 'var(--action-accent)' }}>
        <img src={WOUI_LOGO_URL} alt="" className="h-full w-full object-contain" />
      </div>
      <div className="woui-preloader-bar" aria-hidden="true">
        <span />
      </div>
      <p className="text-[0.875rem]" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
    </div>
  )
}
