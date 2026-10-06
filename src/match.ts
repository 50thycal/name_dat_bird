export type Bird = {
  name: string
  words: string[]
  compact: string
}

export type Mode = 'typed' | 'voice'

export type Verdict =
  | { kind: 'idle' }
  | { kind: 'match'; bird: Bird }
  | { kind: 'maybe'; count: number }
  | { kind: 'none' }

export type SearchResult = {
  results: Bird[]
  verdict: Verdict
  ignored: string[]
}

// Spelling variants that speech recognition and card printing disagree on.
const SYNONYMS: Record<string, string> = {
  grey: 'gray',
}

// Words people say out loud that never appear in a bird name.
const FILLER = new Set([
  'a', 'an', 'the', 'uh', 'um', 'umm', 'er', 'ah', 'oh', 'okay', 'ok', 'so',
  'and', 'next', 'is', 'its', 'it', 'this', 'that', 'one', 'card', 'bird',
  'got', 'have', 'here', 'now', 'then', 'like', 'yeah', 'yes', 'no',
])

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function tokenize(s: string): string[] {
  const n = normalize(s)
  if (!n) return []
  return n.split(' ').map((w) => SYNONYMS[w] ?? w)
}

export function makeBird(name: string): Bird {
  const words = tokenize(name)
  return { name, words, compact: words.join('') }
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }
  return prev[b.length]
}

// How well a single query token matches a single name word, 0..1.
function similarity(q: string, w: string): number {
  if (w.startsWith(q)) return 1
  if (q.length < 4) return 0
  // Plurals / trailing noise from speech: "cardinals" -> "cardinal".
  if (q.startsWith(w) && q.length - w.length <= 2) return 0.95
  const allowed = q.length >= 7 ? 2 : 1
  // Compare against the whole word and against the same-length prefix,
  // so partially typed typos ("nothe") still find "northern".
  const d = Math.min(levenshtein(q, w), levenshtein(q, w.slice(0, q.length)))
  if (d <= allowed) return d === 1 ? 0.8 : 0.7
  return 0
}

type TokenHit = { score: number; word: number }

function bestHit(q: string, bird: Bird): TokenHit {
  let best: TokenHit = { score: 0, word: -1 }
  for (let i = 0; i < bird.words.length; i++) {
    const s = similarity(q, bird.words[i])
    if (s > best.score) best = { score: s, word: i }
  }
  // Run-together words: "redtailed" against "red tailed hawk".
  if (best.score === 0 && q.length >= 5 && bird.compact.includes(q)) {
    best = { score: 0.9, word: -2 }
  }
  return best
}

export function search(query: string, birds: Bird[], mode: Mode): SearchResult {
  let tokens = tokenize(query)
  if (mode === 'voice') tokens = tokens.filter((t) => !FILLER.has(t))
  if (!tokens.length) {
    return { results: birds, verdict: { kind: 'idle' }, ignored: [] }
  }

  // In voice mode, words that match nothing on the list are treated as
  // noise (mishears, filler) rather than wiping out the results.
  const ignored: string[] = []
  let required = tokens
  if (mode === 'voice') {
    required = tokens.filter((t) => birds.some((b) => bestHit(t, b).score > 0))
    for (const t of tokens) if (!required.includes(t)) ignored.push(t)
    if (!required.length) {
      return { results: [], verdict: { kind: 'none' }, ignored }
    }
  }

  const scored: { bird: Bird; score: number; full: boolean }[] = []
  for (const bird of birds) {
    let score = 0
    const covered = new Set<number>()
    let ok = true
    for (const t of required) {
      const hit = bestHit(t, bird)
      if (hit.score === 0) {
        ok = false
        break
      }
      score += hit.score
      if (hit.word >= 0) covered.add(hit.word)
      else if (hit.word === -2) bird.words.forEach((w, i) => t.includes(w) && covered.add(i))
    }
    if (!ok) continue
    const full = covered.size === bird.words.length
    score += full ? 2 : 0
    score -= (bird.words.length - covered.size) * 0.1
    scored.push({ bird, score, full })
  }

  scored.sort((a, b) => b.score - a.score || a.bird.name.localeCompare(b.bird.name))
  const results = scored.map((s) => s.bird)

  let verdict: Verdict
  if (!scored.length) verdict = { kind: 'none' }
  else if (scored[0].full) verdict = { kind: 'match', bird: scored[0].bird }
  else verdict = { kind: 'maybe', count: scored.length }

  return { results, verdict, ignored }
}

// Accepts pasted lists: one per line or comma separated, with optional
// numbering ("12.", "12)") or bullets. Dedupes case-insensitively.
export function parseList(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const parts = text.includes('\n') ? text.split(/\r?\n/) : text.split(',')
  for (const raw of parts) {
    const name = raw
      .replace(/^\s*(?:[-*•]+|\d+\s*[.)\-:]?)\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!name) continue
    const key = normalize(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}
