export type TransliterationMode = 'auto' | 'online' | 'offline' | 'english'

export type ProviderKind = 'online' | 'offline' | 'dictionary' | 'personal' | 'cache' | 'lexicon'

export interface Suggestion {
  /** Kannada Unicode suggestion */
  text: string
  /** Higher is better */
  score: number
  source: ProviderKind
}

export interface TransliterationRequest {
  /** English phonetic input, e.g. "namaskara" */
  text: string
  limit?: number
  signal?: AbortSignal
}

export interface TransliterationResult {
  suggestions: Suggestion[]
  provider: string
  latencyMs: number
  /** True when served from the in-memory/IndexedDB cache */
  cached: boolean
}

export interface TransliterationProvider {
  readonly id: string
  readonly label: string
  readonly kind: 'online' | 'offline'
  isAvailable(): Promise<boolean>
  transliterate(request: TransliterationRequest): Promise<Suggestion[]>
}

export interface TransliterationSettings {
  mode: TransliterationMode
  autoConvert: boolean
  showSuggestions: boolean
  onlineEndpoint: string
  onlineApiKeyHeader: string
  onlineApiKeyValue: string
  personalDictionary: boolean
}

export const DEFAULT_TRANSLITERATION_SETTINGS: TransliterationSettings = {
  mode: 'auto',
  autoConvert: true,
  showSuggestions: true,
  onlineEndpoint: '',
  onlineApiKeyHeader: '',
  onlineApiKeyValue: '',
  personalDictionary: true,
}

export interface DictionaryEntry {
  id?: number
  phonetic: string
  kannada: string
  updatedAt: number
  /** personal = user confirmed, seed = bundled lexicon */
  origin: 'personal' | 'seed'
}
