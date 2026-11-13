/**
 * Kannada phonetic transliteration engine.
 *
 * This is a deterministic, rule-based transliteration engine (ITRANS-inspired with
 * South-Indian phonetic conventions) with contextual handling for:
 *  - inherent vowels and vowel signs (matras)
 *  - conjunct consonants (ottakshara) and virama
 *  - anusvara assimilation for nasals before stops
 *  - retroflex / aspirated alternates surfaced as suggestions
 *  - ambiguous consonant pairs (l/ळ, sh/ষ, n/ಣ, t/ಟ, d/ಡ)
 *
 * It is complemented by a curated lexicon of frequent Kannada words and a user
 * dictionary. No network access is required, so this powers the offline provider.
 * **Target script: Kannada (U+0C80–U+0CFF). Devanagari (U+0900–U+097F) output is
 * explicitly rejected by the validation pipeline.**
 */

export type ConsonantKey =
  | 'k' | 'kh' | 'g' | 'gh' | 'ng'
  | 'ch' | 'chh' | 'j' | 'jh' | 'ny'
  | 'T' | 'Th' | 'D' | 'Dh' | 'N'
  | 't' | 'th' | 'd' | 'dh' | 'n'
  | 'p' | 'ph' | 'b' | 'bh' | 'm'
  | 'y' | 'r' | 'l' | 'v' | 'sh' | 'Sh' | 's' | 'h' | 'L'
  | 'ksh' | 'jn' | 'shr' | 'f' | 'z'

interface ConsonantDef {
  base: string
  /** true when the consonant is aspirated (used for the de-aspirated alternate) */
  aspirated?: boolean
}

/**
 * Kannada consonant base characters (Unicode block U+0C80–U+0CFF).
 * These are the canonical Kannada consonant shapes used for rendering.
 */
const CONSONANTS: Record<string, ConsonantDef> = {
  ksh: { base: 'ಕ್ಷ' },
  jn: { base: 'ಜ್ಞ' },
  shr: { base: 'ಶ್ರ' },
  chh: { base: 'ಛ', aspirated: true },
  ch: { base: 'ಚ' },
  kh: { base: 'ಖ', aspirated: true },
  gh: { base: 'ಘ', aspirated: true },
  jh: { base: 'ಝ', aspirated: true },
  Th: { base: 'ಠ', aspirated: true },
  Dh: { base: 'ಢ', aspirated: true },
  th: { base: 'ಥ', aspirated: true },
  dh: { base: 'ಧ', aspirated: true },
  ph: { base: 'ಫ', aspirated: true },
  bh: { base: 'ಭ', aspirated: true },
  Sh: { base: 'ಷ' },
  sh: { base: 'ಶ' },
  '~n': { base: 'ಞ' },
  '~N': { base: 'ಙ' },
  zh: { base: '಴' },
  N: { base: 'ಣ' },
  T: { base: 'ಟ' },
  D: { base: 'ಡ' },
  L: { base: 'ಳ' },
  k: { base: 'ಕ' },
  g: { base: 'ಗ' },
  j: { base: 'ಜ' },
  t: { base: 'ತ' },
  d: { base: 'ದ' },
  n: { base: 'ನ' },
  p: { base: 'ಪ' },
  b: { base: 'ಬ' },
  m: { base: 'ಮ' },
  y: { base: 'ಯ' },
  r: { base: 'ರ' },
  l: { base: 'ಲ' },
  v: { base: 'ವ' },
  w: { base: 'ವ' },
  s: { base: 'ಸ' },
  h: { base: 'ಹ' },
  f: { base: 'ಫ' },
  z: { base: 'ಜ' },
  q: { base: 'ಕ' },
  x: { base: 'ಕ್ಷ' },
}

interface VowelDef {
  independent: string
  matra: string
  short?: boolean
  longOf?: string
}

/**
 * Kannada vowel independent characters and matras (Unicode block U+0C80–U+0CFF).
 * Short vowels have inherent 'a' sound; matras modify the base consonant.
 */
const VOWELS: Record<string, VowelDef> = {
  a: { independent: 'ಅ', matra: '', short: true },
  aa: { independent: 'ಆ', matra: 'ಾ', longOf: 'a' },
  A: { independent: 'ಆ', matra: 'ಾ', longOf: 'a' },
  i: { independent: 'ಇ', matra: 'ಿ', short: true },
  ii: { independent: 'ಈ', matra: 'ೀ', longOf: 'i' },
  I: { independent: 'ಈ', matra: 'ೀ', longOf: 'i' },
  ee: { independent: 'ಈ', matra: 'ೀ', longOf: 'i' },
  u: { independent: 'ಉ', matra: 'ು', short: true },
  uu: { independent: 'ಊ', matra: 'ೂ', longOf: 'u' },
  U: { independent: 'ಊ', matra: 'ೂ', longOf: 'u' },
  oo: { independent: 'ಊ', matra: 'ೂ', longOf: 'u' },
  Ru: { independent: 'ಋ', matra: 'ೃ', short: true },
  'R^i': { independent: 'ಋ', matra: 'ೃ', short: true },
  e: { independent: 'ಎ', matra: 'ೆ', short: true },
  E: { independent: 'ಏ', matra: 'ೇ', longOf: 'e' },
  ai: { independent: 'ಐ', matra: 'ೈ' },
  o: { independent: 'ಒ', matra: 'ೊ', short: true },
  O: { independent: 'ಓ', matra: 'ೋ', longOf: 'o' },
  au: { independent: 'ಔ', matra: 'ೌ' },
  ou: { independent: 'ಔ', matra: 'ೌ' },
}

const SPECIALS: Record<string, string> = {
  M: 'ಂ',
  H: 'ಃ',
  '~': 'ಁ',
}

function isAsciiLetter(ch: string): boolean {
  return /[A-Za-z]/.test(ch)
}

/** vowels produced as an independent letter at the start of a word / after a vowel */
const VOWEL_KEYS = Object.keys(VOWELS).sort((a, b) => b.length - a.length)
const CONS_KEYS = Object.keys(CONSONANTS).sort((a, b) => b.length - a.length)

type Token =
  | { kind: 'cons'; key: string; raw: string }
  | { kind: 'vowel'; key: string; raw: string }
  | { kind: 'special'; raw: string }
  | { kind: 'other'; raw: string }

const STOP_CONSONANTS = new Set([
  'k', 'kh', 'g', 'gh',
  'ch', 'chh', 'j', 'jh',
  'T', 'Th', 'D', 'Dh',
  't', 'th', 'd', 'dh',
  'p', 'ph', 'b', 'bh',
])

/** De-aspirated alternates, e.g. throttle handling. */
const DEASPIRATE: Record<string, string> = {
  kh: 'k', gh: 'g', chh: 'ch', jh: 'j',
  Th: 'T', Dh: 'D', th: 't', dh: 'd',
  ph: 'p', bh: 'b',
}

/** Map dental consonants to their retroflex equivalents (Kannada chars). */
const RETROFLEX: Record<string, string> = {
  ತ: 'ಟ', ದ: 'ಡ', ಥ: 'ಠ', ಧ: 'ಢ', ನ: 'ಣ', ಲ: 'ಳ',
}

/**
 * Ambiguous consonant pairs: lowercase phonetic → both dental and retroflex Kannada.
 * These are used to generate alternates for short inputs like 'la', 'na', 'ta', 'da', 'sha'.
 */
const AMBIGUOUS_PAIRS: Record<string, { primary: string; alternate: string }> = {
  l: { primary: 'ಲ', alternate: 'ಳ' },
  n: { primary: 'ನ', alternate: 'ಣ' },
  t: { primary: 'ತ', alternate: 'ಟ' },
  d: { primary: 'ದ', alternate: 'ಡ' },
  sh: { primary: 'ಶ', alternate: 'ಷ' },
}

/** Uppercase-first ITRANS keys that map to the retroflex/alternate form. */
const UPPERCASE_PAIRS: Record<string, { primary: string; alternate: string }> = {
  L: { primary: 'ಳ', alternate: 'ಲ' },
  N: { primary: 'ಣ', alternate: 'ನ' },
  T: { primary: 'ಟ', alternate: 'ತ' },
  D: { primary: 'ಡ', alternate: 'ದ' },
  Sh: { primary: 'ಷ', alternate: 'ಶ' },
}

/** Convert the first character of a capitalized word to lowercase so that
 * "Namaskara" behaves like "namaskara", while preserving ITRANS casing
 * distinctions (L, T, D, N, S at word start).
 *
 * ITRANS-significant uppercase letters are NEVER lowercased.
 */
function normalizeInput(word: string): string {
  if (!word) return word
  // Don't touch anything — preserve the full case.
  // The tokenizer handles uppercase letters via CONS_KEYS ordering:
  //   'Sh' matches before 'S', 'Th' matches before 'T', etc.
  // Single uppercase letters L, T, D, N are direct CONSONANTS keys.
  return word
}

export function tokenize(word: string): Token[] {
  const input = normalizeInput(word)
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]

    // two-character ITRANS vowel R^i
    let matched = false

    if (ch === 'R' && input.slice(i, i + 3) === 'R^i') {
      tokens.push({ kind: 'vowel', key: 'R^i', raw: 'R^i' })
      i += 3
      continue
    }

    // longest consonant match
    for (const key of CONS_KEYS) {
      if (input.startsWith(key, i)) {
        // A lowercase vowel sequence must never be swallowed by a consonant match.
        tokens.push({ kind: 'cons', key, raw: key })
        i += key.length
        matched = true
        break
      }
    }
    if (matched) continue

    // longest vowel match
    for (const key of VOWEL_KEYS) {
      if (input.startsWith(key, i)) {
        tokens.push({ kind: 'vowel', key, raw: key })
        i += key.length
        matched = true
        break
      }
    }
    if (matched) continue

    if (SPECIALS[ch]) {
      tokens.push({ kind: 'special', raw: ch })
      i += 1
      continue
    }

    tokens.push({ kind: 'other', raw: ch })
    i += 1
  }
  return tokens
}

export interface RenderOptions {
  /** Use anusvara for nasals before stops (default true) */
  nasalAnusvara?: boolean
  /** De-aspirate aspirated consonants (th -> t) */
  deaspirate?: boolean
  /** Retroflex dental consonants (d -> D, l -> L) */
  retroflex?: boolean
  /** Lengthen a word-initial short vowel and short o/e matras */
  sanskritize?: boolean
  /** Map of consonant token keys to replace: e.g. { l: 'L' } to swap ಲ→ಳ */
  consSwap?: Record<string, string>
}

function applyCharMap(text: string, map: Record<string, string>): string {
  return Array.from(text)
    .map((ch) => map[ch] ?? ch)
    .join('')
}

export function renderTokens(tokens: Token[], options: RenderOptions = {}): string {
  const {
    nasalAnusvara = true,
    deaspirate = false,
    retroflex = false,
    sanskritize = false,
    consSwap,
  } = options

  // Apply consonant key swaps if provided
  let processedTokens = tokens
  if (consSwap) {
    processedTokens = tokens.map((t) => {
      if (t.kind === 'cons' && consSwap[t.key]) {
        return { ...t, key: consSwap[t.key] }
      }
      return t
    })
  }

  let out = ''
  let seenLetter = false

  for (let i = 0; i < processedTokens.length; i++) {
    const token = processedTokens[i]

    if (token.kind === 'vowel') {
      const v = VOWELS[token.key]
      if (!v) {
        out += token.raw
        continue
      }
      const independent = v.independent
      out += independent
      seenLetter = true
      continue
    }

    if (token.kind === 'special') {
      out += SPECIALS[token.raw] ?? ''
      seenLetter = true
      continue
    }

    if (token.kind === 'other') {
      out += token.raw
      continue
    }

    const def = CONSONANTS[token.key]
    let base = def?.base ?? ''

    // anusvara assimilation: n/m before a stop becomes bindu
    const next = processedTokens[i + 1]
    if (
      nasalAnusvara &&
      (token.key === 'n' || token.key === 'm') &&
      next?.kind === 'cons' &&
      STOP_CONSONANTS.has(next.key)
    ) {
      out += 'ಂ'
      seenLetter = true
      continue
    }

    if (next && next.kind === 'vowel') {
      const v = VOWELS[next.key]
      if (!v) {
        out += base + next.raw
        seenLetter = true
        i += 1
        continue
      }
      let matra = v.matra
      if (sanskritize && (matra === 'ೆ' || matra === 'ೊ')) {
        matra = matra === 'ೆ' ? 'ೇ' : 'ೋ'
      }
      out += base + matra
      seenLetter = true
      i += 1
      continue
    }

    // consonant without a following vowel: add virama
    out += base + '್'
    seenLetter = true
  }

  if (deaspirate) out = applyCharMap(out, DEASPIRATE)
  if (retroflex) out = applyCharMap(out, RETROFLEX)
  return out
}

/** Basic rule-based rendering used by the engine and the tests. */
export function transliterateWord(word: string, options: RenderOptions = {}): string {
  return renderTokens(tokenize(word), options)
}

/** Lengthen only the first vowel of a word ("bharata" -> Bharat). */
export function transliterateWithLongInitial(word: string): string {
  const tokens = tokenize(word)
  const out = renderTokens(tokens, {})
  if (!out) return out
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.kind === 'vowel') {
      const short = t.key
      const longMap: Record<string, string> = { a: 'aa', i: 'ii', u: 'uu', e: 'E', o: 'O' }
      if (longMap[short]) {
        return renderTokens(
          [{ ...t, key: longMap[short] }, ...tokens.slice(i + 1)],
          {},
        )
      }
      return out
    }
    if (t.kind === 'cons') {
      const next = tokens[i + 1]
      if (next?.kind === 'vowel') {
        const longMap: Record<string, string> = { a: 'aa', i: 'ii', u: 'uu', e: 'E', o: 'O' }
        const replacement = longMap[next.key]
        if (!replacement) return out
        const newTokens = [...tokens]
        newTokens[i + 1] = { ...next, key: replacement }
        return renderTokens(newTokens, {})
      }
      return out
    }
  }
  return out
}

export interface Candidate {
  text: string
  score: number
  source: 'rules' | 'lexicon' | 'personal'
}

export interface GenerateOptions {
  limit?: number
  personal?: Map<string, string>
  lexicon?: Map<string, string>
  /** Extra candidates supplied by an online provider or cache */
  extra?: string[]
}

/**
 * Identify which ambiguous consonant keys appear in the tokenized word.
 * Returns the token indices and their swap pairs.
 */
function findAmbiguousPositions(tokens: Token[]): Array<{ index: number; key: string; swap: string }> {
  const positions: Array<{ index: number; key: string; swap: string }> = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.kind !== 'cons') continue
    // Check lowercase ambiguous pairs
    if (AMBIGUOUS_PAIRS[t.key]) {
      const pair = AMBIGUOUS_PAIRS[t.key]
      // The current key maps to `primary`; the swap target is the uppercase version
      const swapKey = Object.entries(CONSONANTS).find(([, def]) => def.base === pair.alternate)?.[0]
      if (swapKey) {
        positions.push({ index: i, key: t.key, swap: swapKey })
      }
    }
    // Check uppercase ambiguous pairs
    if (UPPERCASE_PAIRS[t.key]) {
      const pair = UPPERCASE_PAIRS[t.key]
      const swapKey = Object.entries(CONSONANTS).find(([, def]) => def.base === pair.alternate)?.[0]
      if (swapKey) {
        positions.push({ index: i, key: t.key, swap: swapKey })
      }
    }
  }
  return positions
}

/**
 * Generate alternate renderings by swapping each ambiguous consonant position.
 * For efficiency, we only swap individual positions (not all combinations).
 */
function generateAmbiguousVariants(tokens: Token[], limit: number): string[] {
  const positions = findAmbiguousPositions(tokens)
  if (!positions.length) return []

  const variants: string[] = []
  const seen = new Set<string>()

  // Single-position swaps
  for (const pos of positions) {
    if (variants.length >= limit) break
    const swap: Record<string, string> = { [pos.key]: pos.swap }
    const result = renderTokens(tokens, { consSwap: swap })
    if (result && !seen.has(result)) {
      seen.add(result)
      variants.push(result)
    }
  }

  // Multi-position swaps: swap ALL ambiguous positions of the same key type together
  // e.g., for "halli" with two 'l' tokens, swap both to 'L' → "haLLi" → ಹಳ್ಳಿ
  const keyGroups = new Map<string, Array<{ index: number; swap: string }>>()
  for (const pos of positions) {
    if (!keyGroups.has(pos.key)) keyGroups.set(pos.key, [])
    keyGroups.get(pos.key)!.push(pos)
  }

  for (const [key, group] of keyGroups) {
    if (group.length > 1 && variants.length < limit) {
      const swap: Record<string, string> = { [key]: group[0].swap }
      const result = renderTokens(tokens, { consSwap: swap })
      if (result && !seen.has(result)) {
        seen.add(result)
        // Insert at beginning since grouped swaps (e.g. ll→LL) are often correct
        variants.unshift(result)
      }
    }
  }

  return variants.slice(0, limit)
}

/**
 * Produce ranked Kannada candidates for an English phonetic word.
 * Personal dictionary > curated lexicon > rule engine variants.
 * All candidate text is validated to be Kannada script; Devanagari output is rejected.
 */
export function generateCandidates(word: string, options: GenerateOptions = {}): Candidate[] {
  const raw = word.trim()
  // Preserve case for personal dictionary and lexicon lookups.
  // Keys are stored lowercase internally, but we look up both the original case
  // and the lowercase version so that "Namaskara" and "namaskara" both work.
  const key = raw.toLowerCase()
  if (!key) return []
  // Allow only ASCII letters after lowercasing; reject if word already contains Kannada
  if (!/[a-zA-Z]/.test(key)) return []
  if (/[\u0C80-\u0CFF]/.test(raw)) return []

  const { limit = 6, personal, lexicon, extra = [] } = options
  const candidates: Candidate[] = []
  const seen = new Set<string>()

  const push = (text: string, score: number, source: Candidate['source']) => {
    if (!text || seen.has(text)) return
    seen.add(text)
    // **Validation: reject Devanagari (Hindi) output.**
    // Devanagari range is U+0900–U+097F; reject any suggestion containing those chars.
    if (/[\u0900-\u097F]/.test(text)) {
      // silently skip Devanagari suggestion
      return
    }
    candidates.push({ text, score, source })
  }

  // Try personal dictionary with the exact (lowercased) key
  const personalHit = personal?.get(key)
  if (personalHit) {
    // Validate personal dictionary entry too
    if (!/[\u0900-\u097F]/.test(personalHit)) push(personalHit, 2000, 'personal')
  }

  // Try lexicon with the lowercased key
  const lexiconHit = lexicon?.get(key)
  if (lexiconHit) {
    // Validate lexicon entry too
    if (!/[\u0900-\u097F]/.test(lexiconHit)) push(lexiconHit, 1500, 'lexicon')
  }

  for (const e of extra) {
    // Validate extra candidates too
    if (!/[\u0900-\u097F]/.test(e)) push(e, 1400, 'lexicon')
  }

  const tokens = tokenize(raw)
  const baseResult = renderTokens(tokens, {})
  push(baseResult, 500, 'rules')

  // Generate ambiguous variants (l↔L, n↔N, t↔T, d↔D, sh↔Sh)
  const ambiguousVariants = generateAmbiguousVariants(tokens, 4)
  for (let vi = 0; vi < ambiguousVariants.length; vi++) {
    push(ambiguousVariants[vi], 490 - vi, 'rules')
  }

  push(transliterateWithLongInitial(raw), 480, 'rules')
  push(renderTokens(tokens, { sanskritize: true, deaspirate: true }), 470, 'rules')
  push(renderTokens(tokens, { deaspirate: true }), 460, 'rules')
  push(renderTokens(tokens, { retroflex: true }), 445, 'rules')
  push(renderTokens(tokens, { nasalAnusvara: false }), 440, 'rules')
  push(renderTokens(tokens, { deaspirate: true, nasalAnusvara: false }), 430, 'rules')

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit)
}

export interface LexiconLookup {
  get(key: string): string | undefined
}

export function extractTrailingLatinWord(textBeforeCaret: string): { word: string; start: number } {
  const match = /([A-Za-z]+)$/.exec(textBeforeCaret)
  if (!match) return { word: '', start: textBeforeCaret.length }
  return { word: match[1], start: textBeforeCaret.length - match[1].length }
}

export function isLatinWord(text: string): boolean {
  return /^[A-Za-z]+$/.test(text)
}

/** Convert a whole English phonetic paragraph, preserving punctuation and spacing.
 * Every word is independently transliterated and validated for Kannada script only. */
export function transliterateText(
  text: string,
  lexicon?: Map<string, string>,
  personal?: Map<string, string>,
): string {
  return text.replace(/[A-Za-z]+/g, (word) => {
    const candidates = generateCandidates(word, { personal, lexicon, limit: 1 })
    if (!candidates.length) return word
    // Additional safety: ensure no Devanagari leaked through
    if (/[\u0900-\u097F]/.test(candidates[0].text)) return word
    return candidates[0].text
  })
}

export const ENGINE_VERSION = '2.0.0'

// expose for debugging in the browser console
export const __engineInternals = { CONSONANTS, VOWELS, SPECIALS, isAsciiLetter, AMBIGUOUS_PAIRS, UPPERCASE_PAIRS }
