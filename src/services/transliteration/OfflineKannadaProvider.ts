import type { TransliterationProvider, Suggestion } from '@/types/transliteration'
import { generateCandidates } from './engine'
import { SEED_LEXICON } from './lexicon'
import { DictionaryService } from '@/services/storage/DocumentService'

const PERSONAL_TTL = 2500

/**
 * Bundled offline provider.
 *
 * Runs entirely in the browser with zero network access. It combines a
 * deterministic phonetic rule engine with a curated lexicon and the user's
 * personal dictionary. This is a real transliteration engine (not a lookup-only
 * dictionary), and it is the guaranteed fallback when no online model is
 * configured or the network is unavailable.
 */
export class OfflineKannadaProvider implements TransliterationProvider {
  readonly id = 'offline-engine'
  readonly label = 'Offline engine'
  readonly kind = 'offline' as const

  private personal: Map<string, string> | null = null
  private personalLoadedAt = 0

  async isAvailable(): Promise<boolean> {
    return true
  }

  async transliterate({ text, limit = 6 }: { text: string; limit?: number }): Promise<Suggestion[]> {
    const personal = await this.getPersonalMap()
    return generateCandidates(text, {
      limit,
      personal,
      lexicon: SEED_LEXICON as Map<string, string>,
    }).map((c) => ({
      text: c.text,
      score: c.score,
      source: c.source === 'rules' ? 'offline' : c.source,
    }))
  }

  invalidatePersonal(): void {
    this.personal = null
    this.personalLoadedAt = 0
  }

  private async getPersonalMap(): Promise<Map<string, string> | undefined> {
    const fresh = this.personal && Date.now() - this.personalLoadedAt < PERSONAL_TTL
    if (fresh) return this.personal ?? undefined
    try {
      this.personal = await DictionaryService.getPersonalMap()
      this.personalLoadedAt = Date.now()
    } catch {
      this.personal = this.personal ?? new Map()
    }
    return this.personal ?? undefined
  }
}

export const offlineKannadaProvider = new OfflineKannadaProvider()
