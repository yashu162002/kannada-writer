import {
  DEFAULT_TRANSLITERATION_SETTINGS,
  type Suggestion,
  type TransliterationMode,
  type TransliterationResult,
  type TransliterationSettings,
} from '@/types/transliteration'
import { generateCandidates, transliterateText } from './engine'
import { SEED_LEXICON } from './lexicon'
import { offlineKannadaProvider } from './OfflineKannadaProvider'
import { onlineKannadaProvider } from './OnlineKannadaProvider'
import { transliterationCache } from './TransliterationCache'
import { DictionaryService } from '@/services/storage/DocumentService'

const STORAGE_KEY = 'kannada-writer.transliteration-settings'

function loadSettings(): TransliterationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_TRANSLITERATION_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<TransliterationSettings>
    return {
      ...DEFAULT_TRANSLITERATION_SETTINGS,
      ...parsed,
      mode: isMode(parsed.mode) ? parsed.mode : 'auto',
    }
  } catch {
    return { ...DEFAULT_TRANSLITERATION_SETTINGS }
  }
}

function isMode(value: unknown): value is TransliterationMode {
  return value === 'auto' || value === 'online' || value === 'offline' || value === 'english'
}

export interface ProviderStatus {
  mode: TransliterationMode
  onlineConfigured: boolean
  onlineReachable: boolean
  label: string
  description: string
}

class TransliterationService {
  private settings: TransliterationSettings = loadSettings()
  private personal = new Map<string, string>()
  private readyPromise: Promise<void> | null = null
  private lastProvider = 'offline-engine'

  constructor() {
    this.applySettings()
    window.addEventListener('online', () => this.handleConnectivity())
    window.addEventListener('offline', () => this.handleConnectivity())
  }

  private handleConnectivity(): void {
    // cache bounce so provider status UI refreshes
    window.dispatchEvent(new CustomEvent('kannada-writer:connectivity'))
  }

  getSettings(): TransliterationSettings {
    return { ...this.settings }
  }

  updateSettings(patch: Partial<TransliterationSettings>): TransliterationSettings {
    this.settings = { ...this.settings, ...patch }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings))
    } catch {
      /* storage may be unavailable in private mode */
    }
    this.applySettings()
    window.dispatchEvent(new CustomEvent('kannada-writer:transliteration-settings', { detail: this.settings }))
    return this.getSettings()
  }

  private applySettings(): void {
    onlineKannadaProvider.configure({
      endpoint: this.settings.onlineEndpoint,
      headerName: this.settings.onlineApiKeyHeader,
      headerValue: this.settings.onlineApiKeyValue,
    })
  }

  setMode(mode: TransliterationMode): void {
    this.updateSettings({ mode })
  }

  async init(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.loadPersonalDictionary().catch(() => undefined)
    }
    return this.readyPromise
  }

  private async loadPersonalDictionary(): Promise<void> {
    try {
      this.personal = await DictionaryService.getPersonalMap()
    } catch {
      this.personal = new Map()
    }
  }

  async invalidatePersonalDictionary(): Promise<void> {
    offlineKannadaProvider.invalidatePersonal()
    await this.loadPersonalDictionary()
  }

  get offlineReady(): boolean {
    return SEED_LEXICON.size > 0
  }

  get providerStatus(): ProviderStatus {
    const configured = onlineKannadaProvider.isConfigured()
    const onlineReachable = configured && typeof navigator !== 'undefined' && navigator.onLine !== false
    let label = 'Offline engine'
    let description = 'Bundled phonetic engine · no internet required'
    if (this.settings.mode === 'english') {
      label = 'English only'
      description = 'Kannada conversion is disabled'
    } else if (this.settings.mode === 'online') {
      label = configured ? 'Online (IndicXlit-compatible)' : 'Online not configured'
      description = configured
        ? 'Uses your configured transliteration endpoint'
        : 'Add an endpoint in settings; offline fallback remains active'
    } else if (this.settings.mode === 'auto') {
      if (onlineReachable) {
        label = 'Automatic · online available'
        description = 'Online suggestions with instant offline fallback'
      } else if (configured) {
        label = 'Automatic · offline'
        description = 'Online endpoint unreachable; using bundled engine'
      } else {
        label = 'Automatic · offline'
        description = 'No online endpoint configured; using bundled engine'
      }
    }
    return {
      mode: this.settings.mode,
      onlineConfigured: configured,
      onlineReachable,
      label,
      description,
    }
  }

  /**
   * Synchronous local suggestions — powers instant typing feedback.
   */
  localSuggestions(word: string, limit = 6): Suggestion[] {
    if (!word || !/^[a-zA-Z]+$/.test(word)) return []
    if (this.settings.mode === 'english') return []

    const cached = transliterationCache.get(word)
    if (cached?.length) {
      return cached.map((text, i) => ({ text, score: 1200 - i, source: 'cache' }))
    }

    const results = generateCandidates(word, {
      limit,
      personal: this.personal,
      lexicon: SEED_LEXICON as Map<string, string>,
    })

    transliterationCache.rememberLocal(
      word,
      results.map((r) => r.text),
      'offline-engine',
    )

    // persist asynchronously for the next session
    void transliterationCache.set(
      word,
      results.map((r) => r.text),
      'offline-engine',
    )

    return results.map((r) => ({
      text: r.text,
      score: r.score,
      source: r.source === 'rules' ? 'offline' : r.source,
    }))
  }

  private shouldUseOnline(): boolean {
    if (this.settings.mode === 'english' || this.settings.mode === 'offline') return false
    if (!onlineKannadaProvider.isConfigured()) return false
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
    return true
  }

  /**
   * Full transliteration with automatic fallback. Local results are guaranteed;
   * online results (when configured) are ranked above them.
   */
  async suggest(word: string, limit = 6): Promise<TransliterationResult> {
    const started = performance.now()
    if (this.settings.mode === 'english' || !word) {
      return { suggestions: [], provider: 'disabled', latencyMs: 0, cached: false }
    }
    await this.init()

    const local = this.localSuggestions(word, limit)
    if (!this.shouldUseOnline()) {
      return {
        suggestions: local,
        provider: 'offline-engine',
        latencyMs: Math.round(performance.now() - started),
        cached: local.some((s) => s.source === 'cache'),
      }
    }

    try {
      const online = await onlineKannadaProvider.transliterate({ text: word, limit })
      const merged: Suggestion[] = []
      const seen = new Set<string>()
      for (const s of [...online, ...local]) {
        if (!seen.has(s.text)) {
          seen.add(s.text)
          merged.push(s)
        }
      }
      this.lastProvider = onlineKannadaProvider.id
      const texts = merged.map((s) => s.text)
      void transliterationCache.set(word, texts, onlineKannadaProvider.id)
      return {
        suggestions: merged.slice(0, limit),
        provider: onlineKannadaProvider.label,
        latencyMs: Math.round(performance.now() - started),
        cached: false,
      }
    } catch {
      this.lastProvider = offlineKannadaProvider.id
      return {
        suggestions: local,
        provider: 'offline-engine (online unavailable)',
        latencyMs: Math.round(performance.now() - started),
        cached: local.some((s) => s.source === 'cache'),
      }
    }
  }

  getLastProvider(): string {
    return this.lastProvider
  }

  /** Convert an arbitrary English phonetic string, word by word (used by "Convert selection"). */
  convertText(text: string): string {
    return transliterateText(text, SEED_LEXICON as Map<string, string>, this.personal)
  }

  async remember(word: string, kannada: string): Promise<void> {
    if (!this.settings.personalDictionary) return
    await DictionaryService.remember(word, kannada)
    this.personal.set(word.toLowerCase(), kannada)
    offlineKannadaProvider.invalidatePersonal()
  }

  async clearCache(): Promise<void> {
    await transliterationCache.clear()
  }
}

export const transliterationService = new TransliterationService()
