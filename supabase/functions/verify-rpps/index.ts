// supabase/functions/verify-rpps/index.ts
//
// Enregistre et vérifie un numéro RPPS dans l'Annuaire Santé
// (API FHIR en libre accès de l'Agence du Numérique en Santé).
//
// - Réservé à un utilisateur connecté ; il ne peut vérifier que son propre compte.
// - Corps : { rpps?: string, practitionerId?: string } — s'il est fourni, le numéro (11 chiffres) remplace
//   l'actuel. Avec practitionerId (offre Clinique), c'est le profil de ce praticien qui est vérifié.
// - Résultat enregistré dans rpps_status :
//     verified  : le numéro existe et le nom de famille correspond
//     mismatch  : le numéro existe, mais le nom ne correspond pas
//     not_found : le numéro n'existe pas dans l'annuaire (les envois sont alors bloqués)
//     unverified: annuaire indisponible ou clé absente — rien n'est bloqué
//
// Secrets : ANS_API_KEY (clé de l'application sur portal.api.esante.gouv.fr),
//           ANS_API_URL (optionnel, par défaut l'API FHIR v2).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANS_API_KEY = Deno.env.get('ANS_API_KEY') ?? ''
const ANS_API_URL = (Deno.env.get('ANS_API_URL') ?? 'https://gateway.api.esante.gouv.fr/fhir/v2').replace(/\/$/, '')

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

/** Majuscules, sans accents ni ponctuation : « Lefèvre-Martin » → « LEFEVRE MARTIN ». */
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim()

interface FhirName {
  family?: string
  given?: string[]
  text?: string
}
interface FhirPractitioner {
  resourceType?: string
  name?: FhirName[]
}

/** Interroge l'annuaire. null = annuaire indisponible ; [] = numéro inconnu. */
async function lookup(rpps: string): Promise<FhirName[] | null> {
  // Selon la version de l'API, l'identifiant est le RPPS seul ou l'identifiant national (« 8 » + RPPS).
  for (const identifier of [rpps, `8${rpps}`]) {
    const response = await fetch(`${ANS_API_URL}/Practitioner?identifier=${identifier}&_count=5`, {
      headers: { 'ESANTE-API-KEY': ANS_API_KEY, Accept: 'application/fhir+json' },
    })
    if (!response.ok) {
      console.error('Annuaire Santé:', response.status, (await response.text()).slice(0, 300))
      return null
    }
    const bundle = (await response.json()) as { entry?: { resource?: FhirPractitioner }[] }
    const found = (bundle.entry ?? []).map((e) => e.resource).filter((r): r is FhirPractitioner => r?.resourceType === 'Practitioner')
    if (found.length > 0) return found.flatMap((r) => r.name ?? [])
  }
  return []
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: userData, error: userError } = await admin.auth.getUser(jwt)
    if (userError || !userData?.user) return json({ error: 'Connexion requise' }, 401)

    const { data: doctor } = await admin.from('doctors').select('id, last_name, rpps').eq('user_id', userData.user.id).maybeSingle()
    if (!doctor) return json({ error: 'Compte introuvable' }, 404)

    const body = (await req.json().catch(() => ({}))) as { rpps?: string; practitionerId?: string }
    // Cible : le titulaire du compte, ou un praticien de ce compte (offre Clinique).
    let target = { table: 'doctors', id: doctor.id as string, lastName: doctor.last_name as string | null, rpps: doctor.rpps as string | null }
    if (body.practitionerId) {
      const { data: p } = await admin
        .from('practitioners')
        .select('id, last_name, rpps')
        .eq('id', body.practitionerId)
        .eq('doctor_id', doctor.id)
        .maybeSingle()
      if (!p) return json({ error: 'Profil praticien introuvable' }, 404)
      target = { table: 'practitioners', id: p.id, lastName: p.last_name, rpps: p.rpps }
    }
    const rpps = (body.rpps ?? target.rpps ?? '').replace(/\s/g, '')
    if (!/^[0-9]{11}$/.test(rpps)) return json({ error: 'Le numéro RPPS contient 11 chiffres.' }, 400)

    const save = async (status: string, identity: string | null, checked: boolean) => {
      const { error } = await admin
        .from(target.table)
        .update({ rpps, rpps_status: status, rpps_identity: identity, rpps_checked_at: checked ? new Date().toISOString() : null })
        .eq('id', target.id)
      if (error) throw error
      return json({ rpps, status, identity })
    }

    if (!ANS_API_KEY) return await save('unverified', null, false)

    const names = await lookup(rpps)
    if (names === null) return await save('unverified', null, false)
    if (names.length === 0) return await save('not_found', null, true)

    const identity = names
      .map((n) => n.text ?? [...(n.given ?? []), n.family ?? ''].join(' ').trim())
      .filter(Boolean)[0] ?? null
    const account = normalize(target.lastName ?? '')
    const matches =
      account !== '' &&
      names.some((n) => {
        const family = normalize(n.family ?? n.text ?? '')
        return family !== '' && (family === account || family.includes(account) || account.includes(family))
      })
    return await save(matches ? 'verified' : 'mismatch', identity, true)
  } catch (error) {
    console.error('verify-rpps error:', error)
    return json({ error: 'Erreur interne' }, 500)
  }
})
