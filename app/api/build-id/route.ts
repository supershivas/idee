import { NextResponse } from 'next/server'
import { getBuildId } from '@/lib/buildId'

// Sert le BUILD_ID du build Next.js actuellement déployé, sans cache,
// pour que le client puisse détecter qu'une nouvelle version est en ligne.
export async function GET() {
  return NextResponse.json({ buildId: getBuildId() }, { headers: { 'Cache-Control': 'no-store' } })
}
