import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { findQuoteSignBox, type QuoteSignBox } from '../lib/quoteLayout'
import { uploadPdf } from '../lib/documents'
import type { Consent, NewConsentForm } from '../types'

interface UseConsentsResult {
  consents: Consent[]
  loading: boolean
  error: string | null
  sendConsent: (form: NewConsentForm, practitionerId?: string | null) => Promise<{ error: string | null }>
  resendConsent: (consent: Consent) => Promise<{ error: string | null }>
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
    async (form: NewConsentForm, practitionerId: string | null = null) => {
      if (!doctorId) return { error: 'Praticien non identifié.' }

      const { withConsent, withQuote, withPostop } = form
      if (!withConsent && !withQuote && !withPostop) return { error: 'Choisissez au moins un document à envoyer.' }
      const kind = withConsent && withQuote ? 'both' : withConsent ? 'consent' : withQuote ? 'quote' : 'postop'

      // Devis : le PDF est déposé dans le stockage privé du compte avant la création de l'envoi.
      let quote: { quote_path: string; quote_name: string; quote_sign_box: QuoteSignBox | null } | null = null
      if (withQuote) {
        if (!form.quoteFile) return { error: 'Ajoutez le devis au format PDF.' }
        const uploaded = await uploadPdf(doctorId, 'devis', form.quoteFile)
        if (uploaded.error || !uploaded.path) return { error: uploaded.error ?? 'Le devis n’a pas pu être envoyé.' }
        // Cadres de signature du devis : la signature du patient s'y inscrira directement.
        const signBox = await findQuoteSignBox(form.quoteFile)
        quote = { quote_path: uploaded.path, quote_name: form.quoteFile.name.slice(0, 180), quote_sign_box: signBox }
      }

      // Conseils post-opératoires : PDF choisi à l'envoi, sinon la base joint le modèle du cabinet.
      let postop: { postop_path: string; postop_name: string } | null = null
      if (withPostop && form.postopFile) {
        const uploaded = await uploadPdf(doctorId, 'postop', form.postopFile)
        if (uploaded.error || !uploaded.path) return { error: uploaded.error ?? 'Les conseils post-opératoires n’ont pas pu être envoyés.' }
        postop = { postop_path: uploaded.path, postop_name: form.postopFile.name.slice(0, 180) }
      }

      const appointment = form.appointmentAt ? new Date(form.appointmentAt) : null

      const { data, error: insertError } = await supabase
        .from('consents')
        .insert([
          {
            doctor_id: doctorId,
            patient: form.patient.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || null,
            birth_date: form.birthDate || null,
            procedure: kind === 'quote' ? 'Devis' : form.procedure,
            kind,
            with_postop: withPostop,
            appointment_at: appointment && !Number.isNaN(appointment.getTime()) ? appointment.toISOString() : null,
            ...(quote ?? {}),
            ...(postop ?? {}),
            // Profil praticien qui envoie (Pro, Clinique) ; absent = titulaire du compte.
            ...(practitionerId ? { practitioner_id: practitionerId } : {}),
          },
        ])
        .select()
        .single()

      if (insertError) {
        // Le quota et l'état de l'abonnement sont vérifiés côté base (trigger).
        return { error: insertError.message }
      }

      const consent = data as Consent

      // Optimistic update — le listener realtime dédupliquera si besoin.
      setConsents((c) => [consent, ...c])

      // Déclenche l'envoi de l'email au patient (Edge Function).
      const { error: fnError } = await supabase.functions.invoke('send-consent', {
        body: { consentId: consent.id },
      })

      if (fnError) {
        // Le consentement est bien créé même si l'email a échoué : on prévient sans bloquer.
        return { error: "L'envoi est créé mais l'email n'a pas pu partir. Utilisez « Relancer » depuis le tableau de bord." }
      }

      return { error: null }
    },
    [doctorId]
  )

  // Renvoie le même email que l'envoi initial (lien /sign/:token inchangé) : le token
  // reste valide tant que le consentement n'est pas signé.
  const resendConsent = useCallback(async (consent: Consent) => {
    const { error: fnError } = await supabase.functions.invoke('send-consent', {
      body: { consentId: consent.id },
    })
    if (!fnError) return { error: null }
    // Message explicite renvoyé par la fonction (ex. relance trop rapprochée).
    const response = (fnError as { context?: Response }).context
    if (response && typeof response.json === 'function') {
      try {
        const body = (await response.json()) as { error?: string }
        if (body?.error) return { error: body.error }
      } catch {
        /* corps illisible : message générique */
      }
    }
    return { error: "L'e-mail n'a pas pu partir. Réessayez dans un instant." }
  }, [])

  return { consents, loading, error, sendConsent, resendConsent, refetch: fetchConsents }
}
