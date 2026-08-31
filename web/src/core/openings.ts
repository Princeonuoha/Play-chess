/* Bundled opening database (the open lichess chess-openings set, ~3,800 named
   lines with ECO codes and moves verified legal against chess.js at build time).
   Loaded lazily as a static JSON asset the first time the Explorer is opened. */

export interface OpeningEntry {
  eco: string
  name: string
  primary: string // tier 1, e.g. "Caro-Kann Defense"
  variation: string // tier 2, e.g. "Advance Variation"
  subline: string // tier 3, e.g. "Short Variation" ('' if none)
  moves: string[] // SAN
}

interface RawDB {
  generated: string
  count: number
  openings: { e: string; n: string; m: string }[]
}

export interface OpeningsData {
  entries: OpeningEntry[]
  primaries: string[]
  byPrimary: Map<string, OpeningEntry[]>
}

function parseName(name: string): { primary: string; variation: string; subline: string } {
  const colon = name.indexOf(': ')
  if (colon === -1) return { primary: name.trim(), variation: 'Main line', subline: '' }
  const primary = name.slice(0, colon).trim()
  const rest = name.slice(colon + 2).trim()
  const parts = rest.split(', ')
  return { primary, variation: parts[0] || 'Main line', subline: parts.slice(1).join(', ') }
}

let cache: Promise<OpeningsData> | null = null

export function loadOpenings(): Promise<OpeningsData> {
  if (cache) return cache
  cache = fetch('openings.json')
    .then((r) => {
      if (!r.ok) throw new Error('openings.json ' + r.status)
      return r.json() as Promise<RawDB>
    })
    .then((db) => {
      const entries: OpeningEntry[] = db.openings.map((o) => {
        const { primary, variation, subline } = parseName(o.n)
        return { eco: o.e, name: o.n, primary, variation, subline, moves: o.m ? o.m.split(' ') : [] }
      })
      const byPrimary = new Map<string, OpeningEntry[]>()
      for (const e of entries) {
        const arr = byPrimary.get(e.primary)
        if (arr) arr.push(e)
        else byPrimary.set(e.primary, [e])
      }
      // Order each primary's lines by depth then name so shorter/main lines lead.
      for (const arr of byPrimary.values()) arr.sort((a, b) => a.moves.length - b.moves.length || a.name.localeCompare(b.name))
      const primaries = [...byPrimary.keys()].sort((a, b) => a.localeCompare(b))
      return { entries, primaries, byPrimary }
    })
    .catch((err) => {
      cache = null // allow retry
      throw err
    })
  return cache
}

// A short, rankable set of popular openings to show as quick picks before search.
export const POPULAR_PRIMARIES = [
  'Sicilian Defense',
  'French Defense',
  'Caro-Kann Defense',
  'Ruy Lopez',
  'Italian Game',
  "Queen's Gambit Declined",
  'Slav Defense',
  "King's Indian Defense",
  'Nimzo-Indian Defense',
  'English Opening',
  'Scandinavian Defense',
  'Pirc Defense',
  'London System',
  'Catalan Opening',
  "Queen's Gambit Accepted",
  'Grünfeld Defense',
]

export function searchOpenings(data: OpeningsData, query: string, limit = 40): OpeningEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const starts: OpeningEntry[] = []
  const contains: OpeningEntry[] = []
  for (const e of data.entries) {
    const hay = (e.eco + ' ' + e.name).toLowerCase()
    const idx = hay.indexOf(q)
    if (idx === 0 || e.name.toLowerCase().startsWith(q)) starts.push(e)
    else if (idx > -1) contains.push(e)
    if (starts.length >= limit) break
  }
  return [...starts, ...contains].slice(0, limit)
}
