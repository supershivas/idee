import { readFileSync } from 'fs'
import path from 'path'

// Lit le BUILD_ID du build Next.js actuellement déployé (server-side only).
export function getBuildId(): string | null {
  try {
    return readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim()
  } catch {
    return null
  }
}
