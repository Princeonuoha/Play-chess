// After `vite build`, copy the self-hosted Stockfish engine and the Cloudflare
// cache-header file into dist/ so the built site is fully self-contained.
import { cp, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const root = new URL('../../', import.meta.url) // repo root
const dist = new URL('../../dist/', import.meta.url)

await mkdir(new URL('engine/', dist), { recursive: true })
await cp(new URL('engine/', root), new URL('engine/', dist), { recursive: true })

if (existsSync(new URL('_headers', root))) {
  await cp(new URL('_headers', root), new URL('_headers', dist))
}

console.log('postbuild: copied engine/ and _headers into dist/')
