import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Patient } from '../types'

/** Fiches patients du compte (créées automatiquement à chaque envoi). */
export function usePatients(doctorId: string | null) {
  const [patients, setPatients] = useState<Patient[]>([])

  const refetch = useCallback(async () => {
    if (!doctorId) {
      setPatients([])
      return
    }
    const { data } = await supabase
      .from('patients')
      .select('id, full_name, birth_date, email, phone, updated_at')
      .eq('doctor_id', doctorId)
      .order('updated_at', { ascending: false })
    setPatients((data ?? []) as Patient[])
  }, [doctorId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { patients, refetch }
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Chaque mot saisi doit se retrouver dans le nom et prénom du patient. */
export function matchesName(fullName: string, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const name = normalize(fullName)
  return words.every((w) => name.includes(w))
}

/** « 12/03/1985 » */
export function formatBirthDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
