// Génération de couvertures SVG déterministes (seed = page.id ou page.id-N)

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return (h ^ (h >>> 16)) >>> 0
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateCoverSvg(seed: string): string {
  const h0 = hashSeed(seed)
  const rand = mulberry32(h0)
  const uid = h0.toString(36) // ids uniques par seed (évite les collisions si inliné)

  const baseHue = Math.floor(rand() * 360)
  const hueB = (baseHue + 25 + Math.floor(rand() * 70)) % 360
  const sat = 50 + Math.floor(rand() * 28)
  const lightTop = 58 + Math.floor(rand() * 16)
  const lightBot = 34 + Math.floor(rand() * 16)
  const c1 = `hsl(${baseHue},${sat}%,${lightTop}%)`
  const c2 = `hsl(${hueB},${sat}%,${lightBot}%)`

  const n = 3 + Math.floor(rand() * 3)
  let blobs = ''
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(rand() * 800)
    const cy = Math.floor(rand() * 300)
    const r = 60 + Math.floor(rand() * 150)
    const bh = (baseHue + Math.floor(rand() * 90) - 45 + 360) % 360
    const bl = 44 + Math.floor(rand() * 36)
    const op = (0.22 + rand() * 0.48).toFixed(2)
    blobs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="hsl(${bh},${sat}%,${bl}%)" opacity="${op}"/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient><filter id="b${uid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="42"/></filter></defs><rect width="800" height="300" fill="url(#g${uid})"/><g filter="url(#b${uid})">${blobs}</g></svg>`
}

export function coverDataUri(seed: string): string {
  return `data:image/svg+xml,${encodeURIComponent(generateCoverSvg(seed))}`
}

export function coverSeeds(baseId: string, count = 12): string[] {
  return Array.from({ length: count }, (_, i) => `${baseId}-${i}`)
}
