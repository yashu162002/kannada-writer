import { db } from './Database'
import type { KannadaDocument, PageSettings, BackupFile } from '@/types/document'
import { DEFAULT_PAGE_SETTINGS } from '@/types/document'
import type { DictionaryEntry } from '@/types/transliteration'
import { SEED_LEXICON } from '../transliteration/lexicon'

const EMPTY_DOC = '<p></p>'

export function countWords(text: string): number {
  const trimmed = text.replace(/\u00a0/g, ' ').trim()
  if (!trimmed) return 0
  const kannada = (trimmed.match(/[\u0C80-\u0CFF]+/g) || []).length
  const latin = (trimmed.match(/[A-Za-z0-9\u00C0-\u024F]+/g) || []).length
  return kannada + latin
}

export function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export interface NewDocumentInput {
  title?: string
  content?: string
  pageSettings?: PageSettings
  preferredFont?: string
  preferredFontSize?: number
}

export class DocumentService {
  static async create(input: NewDocumentInput = {}): Promise<KannadaDocument> {
    const now = Date.now()
    const doc: KannadaDocument = {
      id: createId(),
      title: input.title?.trim() || 'Untitled document',
      content: input.content ?? JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
      plainText: '',
      createdAt: now,
      updatedAt: now,
      wordCount: 0,
      characterCount: 0,
      pageSettings: input.pageSettings ?? DEFAULT_PAGE_SETTINGS,
      preferredFont: input.preferredFont ?? 'Noto Sans Kannada',
      preferredFontSize: input.preferredFontSize ?? 14,
      header: { enabled: false, content: '' },
      footer: { enabled: false, content: '' },
      showPageNumbers: false,
      meta: { title: input.title?.trim() || 'Untitled document' },
    }
    await db.documents.add(doc)
    return doc
  }

  static async get(id: string): Promise<KannadaDocument | undefined> {
    return db.documents.get(id)
  }

  static async list(): Promise<KannadaDocument[]> {
    return db.documents.orderBy('updatedAt').reverse().toArray()
  }

  static async save(doc: KannadaDocument): Promise<void> {
    await db.documents.put(doc)
  }

  static async patch(
    id: string,
    patch: Partial<Pick<KannadaDocument, 'title' | 'content' | 'plainText' | 'wordCount' | 'characterCount'>> & {
      updatedAt?: number
    },
  ): Promise<void> {
    await db.documents.update(id, patch)
  }

  static async rename(id: string, title: string): Promise<void> {
    const clean = title.trim() || 'Untitled document'
    const existing = await db.documents.get(id)
    await db.documents.update(id, {
      title: clean,
      updatedAt: Date.now(),
      meta: { ...(existing?.meta ?? { title: clean }), title: clean },
    })
  }

  static async update(id: string, patch: Partial<KannadaDocument>): Promise<void> {
    await db.documents.update(id, { ...patch, updatedAt: Date.now() })
  }

  static async remove(id: string): Promise<void> {
    await db.transaction('rw', db.documents, db.recovery, async () => {
      await db.documents.delete(id)
      await db.recovery.delete(id)
    })
  }

  static async duplicate(id: string): Promise<KannadaDocument | undefined> {
    const original = await db.documents.get(id)
    if (!original) return undefined
    const copy: KannadaDocument = {
      ...original,
      id: createId(),
      title: `${original.title} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      meta: { ...original.meta, title: `${original.title} (copy)` },
    }
    await db.documents.add(copy)
    return copy
  }

  static async search(query: string, sort: 'updated' | 'name' | 'created' = 'updated'): Promise<KannadaDocument[]> {
    const q = query.trim().toLowerCase()
    let docs = await db.documents.toArray()
    if (q) {
      docs = docs.filter(
        (doc) => doc.title.toLowerCase().includes(q) || doc.plainText.toLowerCase().includes(q),
      )
    }
    docs.sort((a, b) => {
      if (sort === 'name') return a.title.localeCompare(b.title, 'en')
      if (sort === 'created') return b.createdAt - a.createdAt
      return b.updatedAt - a.updatedAt
    })
    return docs
  }

  static async exportBackup(): Promise<BackupFile> {
    const [documents, dictionary] = await Promise.all([db.documents.toArray(), db.dictionary.toArray()])
    return {
      app: 'kannada-writer',
      version: 1,
      exportedAt: new Date().toISOString(),
      documents,
      dictionary: dictionary.map((d) => ({ phonetic: d.phonetic, kannada: d.kannada, updatedAt: d.updatedAt })),
    }
  }

  static async importBackup(
    data: unknown,
    mode: 'merge' | 'replace' = 'merge',
  ): Promise<{ imported: number; skipped: number }> {
    if (!data || typeof data !== 'object') throw new Error('This file is not a Kannada Writer backup.')
    const backup = data as Partial<BackupFile>
    const backupDocuments = backup.documents
    if (backup.app !== 'kannada-writer' || !Array.isArray(backupDocuments)) {
      throw new Error('This file is not a valid Kannada Writer backup.')
    }

    let imported = 0
    let skipped = 0

    await db.transaction('rw', db.documents, db.dictionary, async () => {
      if (mode === 'replace') {
        await db.documents.clear()
      }
      for (const raw of backupDocuments) {
        if (!raw || typeof raw !== 'object') {
          skipped++
          continue
        }
        const doc = this.sanitizeImportedDocument(raw as KannadaDocument)
        const existing = await db.documents.get(doc.id)
        if (existing) {
          const incomingNewer = doc.updatedAt > existing.updatedAt
          if (incomingNewer && mode === 'merge') {
            await db.documents.put(doc)
            imported++
          } else {
            skipped++
          }
        } else {
          await db.documents.put(doc)
          imported++
        }
      }
      for (const entry of backup.dictionary ?? []) {
        if (!entry?.phonetic || !entry.kannada) continue
        const existing = await db.dictionary.where('phonetic').equals(entry.phonetic.toLowerCase()).first()
        if (existing?.id) {
          await db.dictionary.update(existing.id, { kannada: entry.kannada, updatedAt: entry.updatedAt || Date.now() })
        } else {
          await db.dictionary.add({
            phonetic: entry.phonetic.toLowerCase(),
            kannada: entry.kannada,
            updatedAt: entry.updatedAt || Date.now(),
            origin: 'personal',
          })
        }
      }
    })
    return { imported, skipped }
  }

  private static sanitizeImportedDocument(raw: KannadaDocument): KannadaDocument {
    const now = Date.now()
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : createId(),
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Untitled document',
      content: typeof raw.content === 'string' && raw.content ? raw.content : EMPTY_DOC,
      plainText: typeof raw.plainText === 'string' ? raw.plainText : '',
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
      wordCount: typeof raw.wordCount === 'number' ? raw.wordCount : 0,
      characterCount: typeof raw.characterCount === 'number' ? raw.characterCount : 0,
      pageSettings: raw.pageSettings ?? DEFAULT_PAGE_SETTINGS,
      preferredFont: raw.preferredFont || 'Noto Sans Kannada',
      preferredFontSize: raw.preferredFontSize || 14,
      header: raw.header ?? { enabled: false, content: '' },
      footer: raw.footer ?? { enabled: false, content: '' },
      showPageNumbers: Boolean(raw.showPageNumbers),
      meta: raw.meta ?? { title: raw.title || 'Untitled document' },
    }
  }

  static async saveRecovery(documentId: string, title: string, content: string): Promise<void> {
    await db.recovery.put({ documentId, title, content, savedAt: Date.now() })
  }

  static async getRecovery(documentId: string) {
    return db.recovery.get(documentId)
  }

  static async clearRecovery(documentId: string): Promise<void> {
    await db.recovery.delete(documentId)
  }
}

/**
 * Personal dictionary: user-confirmed word mappings, seeded with the bundled
 * lexicon only for read-time suggestions (seeds are not duplicated in IndexedDB).
 */
export class DictionaryService {
  static async getPersonalMap(): Promise<Map<string, string>> {
    const entries = await db.dictionary.toArray()
    return new Map(entries.map((e) => [e.phonetic, e.kannada]))
  }

  static async remember(phonetic: string, kannada: string): Promise<void> {
    const key = phonetic.trim().toLowerCase()
    if (!key || !kannada) return
    const existing = await db.dictionary.where('phonetic').equals(key).first()
    if (existing?.id) {
      await db.dictionary.update(existing.id, { kannada, updatedAt: Date.now() })
    } else {
      await db.dictionary.add({ phonetic: key, kannada, updatedAt: Date.now(), origin: 'personal' })
    }
  }

  static async list(): Promise<DictionaryEntry[]> {
    return db.dictionary.orderBy('updatedAt').reverse().toArray()
  }

  static async remove(id: number): Promise<void> {
    await db.dictionary.delete(id)
  }

  static seededWordCount(): number {
    return SEED_LEXICON.size
  }
}
