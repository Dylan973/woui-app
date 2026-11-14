import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { writeCabinetSession } from '../lib/profiles'

export interface PinState {
  hasPin: boolean
  /** La proposition « créer un code ? » a déjà été faite pour ce profil. */
  offered: boolean
}

const MESSAGES: Record<string, string> = {
  wrong: 'Code incorrect.',
  wrong_old: 'Ancien code incorrect.',
  locked: 'Trop d’essais. Réessayez dans 5 minutes.',
  invalid: 'Le code doit contenir 4 chiffres.',
  required: 'Le code de Gestion du cabinet est obligatoire : vous pouvez le changer, pas le supprimer.',
  no_pin: 'Aucun code n’est encore défini pour Gestion du cabinet.',
}

/** Traduit la réponse d'une fonction de code (« ok », « wrong »…) en message, ou null si tout est bon. */
function toMessage(data: unknown, error: { message: string } | null): string | null {
  if (error) return error.message
  return data === 'ok' ? null : (MESSAGES[String(data)] ?? 'Action impossible pour le moment.')
}

/**
 * Codes à 4 chiffres des profils. Le code n'est jamais lu par le navigateur :
 * création, modification et vérification passent par des fonctions de la base.
 */
export function useProfilePins(doctorId: string | null) {
  const [pins, setPins] = useState<Record<string, PinState>>({})
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)

  const refetch = useCallback(async () => {
    if (!doctorId) {
      setPins({})
      setLoading(false)
      return
    }
    const { data, error } = await supabase.rpc('profile_pin_status')
    setAvailable(!error)
    const next: Record<string, PinState> = {}
    for (const row of (data ?? []) as { profile_key: string; has_pin: boolean; offered: boolean }[]) {
      next[row.profile_key] = { hasPin: row.has_pin, offered: row.offered }
    }
    setPins(next)
    setLoading(false)
  }, [doctorId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const verifyPin = useCallback(async (profileId: string, pin: string) => {
    const { data, error } = await supabase.rpc('verify_profile_pin', { p_profile: profileId, p_pin: pin })
    return toMessage(data, error)
  }, [])

  /** Compte cabinet : vérifie le code de « Gestion du cabinet » et garde la session ouverte (12 h). */
  const openCabinetSession = useCallback(
    async (pin: string) => {
      if (!doctorId) return 'Connexion requise.'
      const { data, error } = await supabase.rpc('open_cabinet_session', { p_pin: pin })
      if (error) return error.message
      const value = String(data ?? '')
      if (value.startsWith('ok:')) {
        writeCabinetSession(doctorId, value.slice(3))
        return null
      }
      return MESSAGES[value] ?? 'Action impossible pour le moment.'
    },
    [doctorId]
  )

  const setPin = useCallback(
    async (profileId: string, pin: string, oldPin?: string) => {
      const { data, error } = await supabase.rpc('set_profile_pin', { p_profile: profileId, p_pin: pin, p_old: oldPin ?? null })
      const message = toMessage(data, error)
      if (!message) await refetch()
      return message
    },
    [refetch]
  )

  const removePin = useCallback(
    async (profileId: string, oldPin: string) => {
      const { data, error } = await supabase.rpc('remove_profile_pin', { p_profile: profileId, p_old: oldPin })
      const message = toMessage(data, error)
      if (!message) await refetch()
      return message
    },
    [refetch]
  )

  const markOffered = useCallback(
    async (profileId: string) => {
      setPins((current) => ({ ...current, [profileId]: { hasPin: current[profileId]?.hasPin ?? false, offered: true } }))
      await supabase.rpc('mark_pin_offered', { p_profile: profileId })
    },
    []
  )

  /** Envoie par e-mail un lien qui supprime le code du profil. */
  const requestReset = useCallback(async (profileId: string) => {
    const { data, error } = await supabase.functions.invoke('profile-pin-reset', { body: { profile: profileId } })
    if (error) return { error: 'L’e-mail n’a pas pu être envoyé. Réessayez dans quelques minutes.', sentTo: null }
    return { error: null, sentTo: (data as { sentTo?: string })?.sentTo ?? null }
  }, [])

  /** Lien reçu par e-mail : supprime le code. Renvoie l'identifiant du profil concerné, ou null si le lien n'est plus valable. */
  const confirmReset = useCallback(
    async (token: string) => {
      const { data, error } = await supabase.rpc('reset_profile_pin', { p_token: token })
      if (error || !data) return null
      await refetch()
      return String(data)
    },
    [refetch]
  )

  return { pins, loading, available, refetch, verifyPin, setPin, removePin, markOffered, requestReset, confirmReset, openCabinetSession }
}
