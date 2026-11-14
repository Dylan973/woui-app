import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { uploadPdf } from '../lib/documents'
import type { ConsentTemplate } from '../types'

/** Modèles du cabinet, un PDF par acte : formulaires de consentement et conseils post-opératoires, joints automatiquement aux envois. */
export function useConsentTemplates(doctorId: string | null) {
  const [templates, setTemplates] = useState<ConsentTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!doctorId) {
      setTemplates([])
      setLoading(false)
      return
    }
    const { data } = await supabase.from('consent_templates').select('*').eq('doctor_id', doctorId)
    setTemplates((data ?? []) as ConsentTemplate[])
    setLoading(false)
  }, [doctorId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const saveTemplate = useCallback(
    async (procedure: string, file: File, category: 'consent' | 'postop' = 'consent') => {
      if (!doctorId) return { error: 'Compte non identifié.' }
      const uploaded = await uploadPdf(doctorId, 'modeles', file)
      if (uploaded.error || !uploaded.path) return { error: uploaded.error }
      // L'ancien fichier est conservé : il reste rattaché aux envois déjà partis.
      const changes = { file_path: uploaded.path, file_name: file.name.slice(0, 180) }
      const existing = templates.find((t) => (t.category ?? 'consent') === category && t.procedure === procedure)
      const { error } = existing
        ? await supabase.from('consent_templates').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', existing.id)
        : await supabase.from('consent_templates').insert([{ doctor_id: doctorId, procedure, category, ...changes }])
      if (!error) await refetch()
      return { error: error ? 'Le document n’a pas pu être enregistré.' : null }
    },
    [doctorId, refetch, templates]
  )

  const removeTemplate = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('consent_templates').delete().eq('id', id)
      if (!error) await refetch()
      return { error: error ? 'Le formulaire n’a pas pu être retiré.' : null }
    },
    [refetch]
  )

  return { templates, loading, saveTemplate, removeTemplate }
}
