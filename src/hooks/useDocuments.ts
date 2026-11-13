import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/services/storage/Database'
import { DocumentService } from '@/services/storage/DocumentService'
import type { KannadaDocument } from '@/types/document'
import { toast } from '@/components/common/Toast'

export type SortKey = 'updated' | 'name' | 'created'

export function useDocuments() {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('updated')
  const [busy, setBusy] = useState(false)

  const documents = useLiveQuery(() => db.documents.toArray(), [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let items = documents ?? []
    if (q) {
      items = items.filter(
        (doc) => doc.title.toLowerCase().includes(q) || (doc.plainText ?? '').toLowerCase().includes(q),
      )
    }
    return [...items].sort((a, b) => {
      if (sort === 'name') return a.title.localeCompare(b.title, 'en')
      if (sort === 'created') return b.createdAt - a.createdAt
      return b.updatedAt - a.updatedAt
    })
  }, [documents, query, sort])

  const create = useCallback(async (title = 'Untitled document') => {
    const doc = await DocumentService.create({ title })
    return doc
  }, [])

  const rename = useCallback(async (id: string, title: string) => {
    const clean = title.trim()
    if (!clean) return
    const doc = await DocumentService.get(id)
    await db.documents.update(id, {
      title: clean,
      updatedAt: Date.now(),
      meta: { ...(doc?.meta ?? { title: clean }), title: clean },
    })
    toast('Document renamed', clean)
  }, [])

  const remove = useCallback(async (id: string) => {
    setBusy(true)
    try {
      await DocumentService.remove(id)
      toast('Document deleted', 'The document was removed from this browser.')
    } finally {
      setBusy(false)
    }
  }, [])

  const duplicate = useCallback(async (id: string) => {
    const copy = await DocumentService.duplicate(id)
    if (copy) toast('Document duplicated', copy.title)
    return copy
  }, [])

  const refresh = useCallback(async () => {
    // live query handles refreshes; this keeps the API convenient for callers
    await db.documents.count()
  }, [])

  return {
    documents: filtered,
    allDocuments: documents ?? [],
    loading: documents === undefined,
    query,
    setQuery,
    sort,
    setSort,
    create,
    rename,
    remove,
    duplicate,
    refresh,
    busy,
  }
}

export function useDocument(documentId: string | null) {
  const [doc, setDoc] = useState<KannadaDocument | null>(null)
  const [loading, setLoading] = useState(Boolean(documentId))
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!documentId) {
      setDoc(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const found = await DocumentService.get(documentId)
      setDoc(found ?? null)
      setError(found ? null : 'Document not found')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the document')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    void load()
  }, [load])

  return { doc, setDoc, loading, error, reload: load }
}
