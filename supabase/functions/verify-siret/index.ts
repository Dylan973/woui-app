// supabase/functions/verify-siret/index.ts
//
// Vérifie un numéro SIRET dans l'annuaire public des entreprises (recherche-entreprises.api.gouv.fr,
// sans clé) : utilisé à l'inscription d'un cabinet (offre Clinique), avant la création du compte.
// Corps : { siret: string } → { found, active, name, address }.
//
// Déploiement : supabase functions deploy verify-siret --no-verify-jwt

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

/** 14 chiffres et clé de Luhn valide. */
export function siretValide(siret: string): boolean {
  if (!/^[0-9]{14}$/.test(siret)) return false
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let d = Number(siret[i])
    if ((14 - i) % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

interface Etablissement {
  siret?: string
  etat_administratif?: string
  adresse?: string
}
interface Resultat {
  nom_complet?: string
  siege?: Etablissement
  matching_etablissements?: Etablissement[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    const { siret: raw } = (await req.json().catch(() => ({}))) as { siret?: string }
    const siret = (raw ?? '').replace(/\s/g, '')
    if (!siretValide(siret)) return json({ found: false, valid: false })

    const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`, {
      headers: { Accept: 'application/json' },
    })
    // Annuaire indisponible : on n'empêche pas l'inscription (numéro au bon format).
    if (!response.ok) return json({ found: null, valid: true })
    const data = (await response.json()) as { results?: Resultat[] }
    for (const r of data.results ?? []) {
      const etab = [r.siege, ...(r.matching_etablissements ?? [])].find((e) => e?.siret === siret)
      if (etab) {
        return json({
          found: true,
          valid: true,
          active: (etab.etat_administratif ?? 'A') === 'A',
          name: r.nom_complet ?? null,
          address: etab.adresse ?? null,
        })
      }
    }
    return json({ found: false, valid: true })
  } catch (error) {
    console.error('verify-siret error:', error)
    return json({ found: null, valid: true })
  }
})
