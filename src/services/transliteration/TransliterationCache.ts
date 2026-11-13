import { db } from '@/services/storage/Database'

const TTL_MS = 1000 * 60 * 60 * 24 * 30
const MEMORY_LIMIT = 600

export class TransliterationCache {
  private memory = new Map<string, { suggestions: string[]; provider: string; at: number }>()

  get(word: string): string[] | undefined {
    const key = word.toLowerCase()
    const hit = this.memory.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) {
      // refresh LRU position
      this.memory.delete(key)
      this.memory.set(key, hit)
      return hit.suggestions
    }
    return undefined
  }

  async getPersistent(word: string): Promise<string[] | undefined> {
    const key = word.toLowerCase()
    const cached = this.get(key)
    if (cached) return cached
    try {
      const row = await db.transliterationCache.get(key)
      if (!row) return undefined
      if (Date.now() - row.updatedAt > TTL_MS) {
        await db.transliterationCache.delete(key)
        return undefined
      }
      this.rememberLocal(key, row.suggestions, row.provider)
      return row.suggestions
    } catch {
      return undefined
    }
  }

  rememberLocal(word: string, suggestions: string[], provider: string): void {
    const key = word.toLowerCase()
    this.memory.set(key, { suggestions, provider, at: Date.now() })
    if (this.memory.size > MEMORY_LIMIT) {
      const oldest = this.memory.keys().next().value
      if (oldest) this.memory.delete(oldest)
    }
  }

  async set(word: string, suggestions: string[], provider: string): Promise<void> {
    const key = word.toLowerCase()
    this.rememberLocal(key, suggestions, provider)
    try {
      await db.transliterationCache.put({
        word: key,
        suggestions,
        provider,
        updatedAt: Date.now(),
      })
    } catch {
      /* cache failures must never break typing */
    }
  }

  async clear(): Promise<void> {
    this.memory.clear()
    try {
      await db.transliterationCache.clear()
    } catch {
      /* ignore */
    }
  }
}

export const transliterationCache = new TransliterationCache()
