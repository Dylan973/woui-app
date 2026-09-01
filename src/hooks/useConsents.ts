import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Consent, NewConsentForm } from '../types'

interface UseConsentsResult {
  consents: Consent[]
  loading: boolean
  error: string | null
  sendConsent: (form: NewConsentForm) => Promise<{ error: string | null }>
  refetch: () => Promise<void>
}

/**
 * CRUD + realtime pour les consentements d'un praticien donné.
 * doctorId === null tant que le praticien n'est pas encore chargé (useAuth).
 */
export function useConsents(doctorId: string | null): UseConsentsResult {
  const [consents, setConsents] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConsents = useCallback(async () => {
    if (!doctorId) {
      setConsents([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('consents')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setError(null)
      setConsents((data ?? []) as Consent[])
    }
    setLoading(false)
  }, [doctorId])

  useEffect(() => {
    fetchConsents()
  }, [fetchConsents])

  // Realtime : le statut change en direct quand le patient ouvre/visionne/signe.
  useEffect(() => {
    if (!doctorId) return

    const channel = supabase
      .channel(`consents-doctor-${doctorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consents', filter: `doctor_id=eq.${doctorId}` },
        (payload) => {
          setConsents((current) => {
            if (payload.eventType === 'INSERT') {
              const newRow = payload.new as Consent
              if (current.some((c) => c.id === newRow.id)) return current
              return [newRow, ...current]
            }
            if (payload.eventType === 'UPDATE') {
              const updated = payload.new as Consent
              return current.map((c) => (c.id === updated.id ? updated : c))
            }
            if (payload.eventType === 'DELETE') {
              const removed = payload.old as Consent
              return current.filter((c) => c.id !== removed.id)
            }
            return current
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [doctorId])

  const sendConsent = useCallback(
    async (form: NewConsentForm) => {
      if (!doctorId) return { error: 'Praticien non identifié.' }

      const { data, error: insertError } = await supabase
        .from('consents')
        .insert([
          {
            doctor_id: doctorId,
            patient: form.patient,
            email: form.email,
            procedure: form.procedure,
            status: 'sent',
            video_progress: 0,
          },
        ])
        .select()
        .single()

      if (insertError) return { error: insertError.message }

      const consent = data as Consent

      // Optimistic update — le listener realtime dédupliquera si besoin.
      setConsents((c) => [consent, ...c])

      // Déclenche l'envoi de l'email au patient (Edge Function).
      const { error: fnError } = await supabase.functions.invoke('send-consent', {
        body: {
          consentId: consent.id,
          patientEmail: consent.email,
          patientName: consent.patient,
          procedure: consent.procedure,
          token: consent.token,
        },
      })

      if (fnError) {
        // Le consentement est bien créé même si l'email a échoué : on prévient sans bloquer.
        return { error: `Consentement créé mais l'email n'a pas pu être envoyé (${fnError.message}).` }
      }

      return { error: null }
    },
    [doctorId]
  )

  return { consents, loading, error, sendConsent, refetch: fetchConsents }
}
