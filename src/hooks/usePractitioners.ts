import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { callFunction } from '../lib/functions'
import type { Practitioner, ProfileForm } from '../types'

interface UsePractitionersResult {
  /** Profils ajoutés (hors titulaire du compte), archivés compris. */
  practitioners: Practitioner[]
  loading: boolean
  createPractitioner: (form: ProfileForm) => Promise<{ error: string | null; id?: string }>
  refetch: () => Promise<void>
  setPractitionerPhoto: (id: string, photoPath: string | null) => Promise<{ error: string | null }>
  updatePractitioner: (id: string, form: ProfileForm) => Promise<{ error: string | null }>
  archivePractitioner: (id: string) => Promise<{ error: string | null }>
  /** Enregistre et vérifie le RPPS d'un praticien dans l'Annuaire Santé. */
  verifyRpps: (id: string, rpps: string) => Promise<{ error: string | null; status?: string; identity?: string | null }>
}

/**
 * Profils praticiens d'un compte (offre Clinique).
 * Les règles (offre requise, nombre maximum) sont appliquées côté base.
 */
export function usePractitioners(doctorId: string | null): UsePractitionersResult {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!doctorId) {
      setPractitioners([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('practitioners')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: true })
    if (!error) setPractitioners((data ?? []) as Practitioner[])
    setLoading(false)
  }, [doctorId])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const clean = (form: ProfileForm) => ({
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    specialty: form.specialty.trim() || 'Chirurgien-dentiste',
    color: form.color,
  })

  const createPractitioner = useCallback(
    async (form: ProfileForm) => {
      if (!doctorId) return { error: 'Compte non identifié.' }
      const { data, error } = await supabase
        .from('practitioners')
        .insert([{ doctor_id: doctorId, ...clean(form) }])
        .select('id')
        .single()
      if (!error) await fetchAll()
      return { error: error ? error.message : null, id: (data as { id: string } | null)?.id }
    },
    [doctorId, fetchAll]
  )

  const updatePractitioner = useCallback(
    async (id: string, form: ProfileForm) => {
      const { error } = await supabase
        .from('practitioners')
        .update({ ...clean(form), updated_at: new Date().toISOString() })
        .eq('id', id)
      if (!error) await fetchAll()
      return { error: error ? error.message : null }
    },
    [fetchAll]
  )

  const setPractitionerPhoto = useCallback(
    async (id: string, photoPath: string | null) => {
      const { error } = await supabase.from('practitioners').update({ photo_path: photoPath, updated_at: new Date().toISOString() }).eq('id', id)
      if (!error) await fetchAll()
      return { error: error ? error.message : null }
    },
    [fetchAll]
  )

  // Un profil ne se supprime pas : ses consentements doivent rester attribués à son nom.
  const archivePractitioner = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('practitioners')
        .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id)
      if (!error) await fetchAll()
      return { error: error ? error.message : null }
    },
    [fetchAll]
  )

  const verifyRpps = useCallback(
    async (id: string, rpps: string) => {
      const { data, error } = await callFunction<{ status?: string; identity?: string | null }>(
        'verify-rpps',
        { practitionerId: id, rpps: rpps.replace(/\s/g, '') },
        { fallback: 'Le numéro RPPS n’a pas pu être enregistré. Réessayez.' }
      )
      await fetchAll()
      return { error, status: data?.status, identity: data?.identity ?? null }
    },
    [fetchAll]
  )

  return { practitioners, loading, refetch: fetchAll, createPractitioner, updatePractitioner, archivePractitioner, setPractitionerPhoto, verifyRpps }
}
