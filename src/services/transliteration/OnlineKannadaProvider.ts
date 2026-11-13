import type { Suggestion, TransliterationProvider } from '@/types/transliteration'

interface OnlinePayload {
  text?: string
  word?: string
  source?: string
  target?: string
  source_lang_code?: string
  target_lang_code?: string
  num_suggestions?: number
  input?: Array<{ source: string }>
  config?: {
    language: {
      sourceLanguage: string
      targetLanguage: string
    }
  }
}

const KANNADA_RANGE = /[\u0C80-\u0CFF]/

/**
 * Online Kannada transliteration provider.
 *
 * ── Deployment contract ─────────────────────────────────────────────────────
 * The endpoint must accept `POST` JSON. This provider sends BOTH of these shapes
 * so that it works with a thin proxy in front of AI4Bharat IndicXlit as well as
 * with a simple custom service:
 *
 *  {
 *    "text": "namaskara", "word": "namaskara",
 *    "source": "en", "target": "kn",
 *    "source_lang_code": "en", "target_lang_code": "kn",
 *    "num_suggestions": 6,
 *    "input": [{ "source": "namaskara" }],
 *    "config": { "language": { "sourceLanguage": "en", "targetLanguage": "kn" } }
 *  }
 *
 * Accepted responses:
 *   ["ನಮಸ್ಕಾರ", ...]
 *   { "suggestions": ["ನಮಸ್ಕಾರ"] | [{ "text": "ನಮಸ್ಕಾರ" }] }
 *   { "output": ["ನಮಸ್ಕಾರ"] | [{ "target": ["ನಮಸ್ಕಾರ"] }] }   ← IndicXlit/ULCA
 *   { "result": ..., "data": ..., "transliteration": "..." }
 *
 * No API key is compiled into this app. If your proxy needs a header, add it in
 * Transliteration Settings — it is stored only in this browser. For production,
 * prefer a server-side proxy and leave the key fields empty.
 *
 * If no endpoint is configured, online mode reports "not configured" and the
 * app falls back to the bundled offline engine.
 */
export class OnlineKannadaProvider implements TransliterationProvider {
  readonly id = 'online-indicxlit'
  readonly label = 'Online IndicXlit-compatible'
  readonly kind = 'online' as const

  private endpoint = ''
  private headerName = ''
  private headerValue = ''
  private timeoutMs = 4500

  configure(options: { endpoint: string; headerName?: string; headerValue?: string; timeoutMs?: number }): void {
    this.endpoint = options.endpoint.trim()
    this.headerName = options.headerName?.trim() ?? ''
    this.headerValue = options.headerValue ?? ''
    if (options.timeoutMs) this.timeoutMs = options.timeoutMs
  }

  isConfigured(): boolean {
    return /^https?:\/\//i.test(this.endpoint)
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
    return true
  }

  async transliterate({
    text,
    limit = 6,
    signal,
  }: {
    text: string
    limit?: number
    signal?: AbortSignal
  }): Promise<Suggestion[]> {
    if (!this.isConfigured()) {
      throw new Error('Online transliteration is not configured. Add an endpoint in Transliteration Settings.')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    const abortHandler = () => controller.abort()
    signal?.addEventListener('abort', abortHandler, { once: true })

    const payload: OnlinePayload = {
      text,
      word: text,
      source: 'en',
      target: 'kn',
      source_lang_code: 'en',
      target_lang_code: 'kn',
      num_suggestions: limit,
      input: [{ source: text }],
      config: { language: { sourceLanguage: 'en', targetLanguage: 'kn' } },
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
    if (this.headerName && this.headerValue) headers[this.headerName] = this.headerValue

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
        mode: 'cors',
      })
      if (!response.ok) {
        throw new Error(`Transliteration service returned HTTP ${response.status}.`)
      }
      const data: unknown = await response.json()
      const texts = parseSuggestions(data).slice(0, limit)
      if (!texts.length) throw new Error('The transliteration service returned no suggestions.')
      return texts.map((t, i) => ({
        text: t,
        score: 1600 - i,
        source: 'online' as const,
      }))
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abortHandler)
    }
  }
}

function isKannada(text: string): boolean {
  return KANNADA_RANGE.test(text)
}

function addCandidate(target: string[], value: unknown): void {
  if (typeof value === 'string') {
    const clean = value.trim()
    if (clean && isKannada(clean) && !target.includes(clean)) target.push(clean)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) addCandidate(target, item)
    return
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of ['text', 'target', 'targets', 'suggestion', 'suggestions', 'transliteration', 'output', 'result', 'data']) {
      if (key in obj) addCandidate(target, obj[key])
    }
  }
}

/** Parse the many response shapes a transliteration proxy may return. */
export function parseSuggestions(payload: unknown): string[] {
  const out: string[] = []
  addCandidate(out, payload)
  return out
}

export const onlineKannadaProvider = new OnlineKannadaProvider()
