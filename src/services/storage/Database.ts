import Dexie, { type Table } from 'dexie'
import type { KannadaDocument } from '@/types/document'
import type { DictionaryEntry } from '@/types/transliteration'

export interface CachedTransliteration {
  word: string
  suggestions: string[]
  updatedAt: number
  provider: string
}

export interface RecoverySnapshot {
  documentId: string
  title: string
  content: string
  savedAt: number
}

export interface SettingRow {
  key: string
  value: unknown
}

class KannadaWriterDatabase extends Dexie {
  documents!: Table<KannadaDocument, string>
  dictionary!: Table<DictionaryEntry, number>
  transliterationCache!: Table<CachedTransliteration, string>
  recovery!: Table<RecoverySnapshot, string>
  settings!: Table<SettingRow, string>

  constructor() {
    super('kannada-writer')
    this.version(1).stores({
      documents: 'id, title, updatedAt, createdAt',
      dictionary: '++id, &phonetic, updatedAt',
      transliterationCache: 'word, updatedAt',
      recovery: 'documentId, savedAt',
      settings: 'key',
    })
  }
}

export const db = new KannadaWriterDatabase()

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted?.()
      if (already) return true
      return await navigator.storage.persist()
    }
  } catch {
    /* ignore */
  }
  return false
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  try {
    const estimate = await navigator.storage?.estimate?.()
    return { usage: estimate?.usage ?? 0, quota: estimate?.quota ?? 0 }
  } catch {
    return { usage: 0, quota: 0 }
  }
}
