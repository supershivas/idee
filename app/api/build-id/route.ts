import { NextResponse } from 'next/server'
import { getBuildId } from '@/lib/buildId'

// Sert le BUILD_ID du build Next.js actuellement déployé, sans cache,
// pour que le client puisse détecter qu'une nouvelle version est en ligne.
//
// `force-dynamic` est indispensable ici : cette route ne lit aucune API
// dynamique (pas de cookies/headers), donc Next.js la traite par défaut
// comme statique et la fige dans le Full Route Cache au moment du build —
// le header Cache-Control: no-store ci-dessous ne suffit PAS à l'empêcher,
// il ne s'applique qu'à la réponse déjà figée. Sans ce flag, Vercel a servi
// pendant des heures un buildId obsolète (constaté : x-vercel-cache HIT,
// age > 37000s), empêchant PwaUpdater de jamais détecter les mises à jour.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ buildId: getBuildId() }, { headers: { 'Cache-Control': 'no-store' } })
}
