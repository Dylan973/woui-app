import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Doctor } from '../types'

interface UseAuthResult {
  user: User | null
  doctor: Doctor | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refetchDoctor: () => Promise<void>
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null)
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDoctor = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('doctors').select('*').eq('user_id', userId).maybeSingle()
    if (error) {
      console.error('Erreur lors du chargement du praticien:', error.message)
      setDoctor(null)
      return
    }
    setDoctor(data as Doctor | null)
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (session?.user) await fetchDoctor(session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchDoctor(session.user.id)
      } else {
        setDoctor(null)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [fetchDoctor])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setDoctor(null)
    setUser(null)
  }, [])

  const refetchDoctor = useCallback(async () => {
    if (user) await fetchDoctor(user.id)
  }, [user, fetchDoctor])

  return { user, doctor, loading, signIn, signOut, refetchDoctor }
}
