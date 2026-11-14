import { supabase } from './supabase'
import { readCabinetSession } from './profiles'

/**
 * Appelle une fonction Woui et renvoie ses données ou un message d'erreur lisible
 * (celui renvoyé par la fonction quand il existe).
 * cabinetOf : compte cabinet → envoie le jeton de « Gestion du cabinet » (gestion de l'abonnement).
 */
export async function callFunction<T = Record<string, unknown>>(
  name: string,
  body: object,
  options: { cabinetOf?: string | null; fallback?: string } = {}
): Promise<{ data: T | null; error: string | null }> {
  const token = options.cabinetOf ? readCabinetSession(options.cabinetOf) : null
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: token ? { 'x-woui-cabinet': token } : undefined,
  })
  if (!error) return { data: data as T, error: null }
  const response = (error as { context?: Response }).context
  if (response && typeof response.json === 'function') {
    try {
      const parsed = (await response.json()) as { error?: string }
      if (parsed?.error) return { data: null, error: parsed.error }
    } catch {
      /* corps illisible */
    }
  }
  return { data: null, error: options.fallback ?? 'Le service est momentanément indisponible. Réessayez dans quelques instants.' }
}
