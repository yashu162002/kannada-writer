import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownAZ,
  ArrowUpDown,
  Check,
  Clock3,
  Copy,
  Database,
  Download,
  FileJson,
  FilePlus2,
  FileText,
  HardDrive,
  MoreVertical,
  PencilLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import { useDocuments, type SortKey } from '@/hooks/useDocuments'
import { DocumentService, countWords } from '@/services/storage/DocumentService'
import { getStorageEstimate } from '@/services/storage/Database'
import { transliterationService } from '@/services/transliteration/TransliterationService'
import type { KannadaDocument } from '@/types/document'
import type { Suggestion, TransliterationSettings } from '@/types/transliteration'
import { Button } from '@/components/common/Button'
import { Dialog, ConfirmDialog } from '@/components/common/Dialog'
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/common/Dropdown'
import { toast } from '@/components/common/Toast'
import { formatBytes, relativeTime, downloadBlob, sanitizeFilename, cn } from '@/lib/utils'

interface Props {
  onOpenDocument: (id: string) => void
  onCreateDocument: () => Promise<string | null>
}

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'updated', label: 'Last edited' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'created', label: 'Date created' },
]

const DEMO_WORDS = ['namaskara', 'kannada', 'bengaluru', 'hesaru', 'hosa', 'shale', 'mane', 'namma', 'kathe', 'belaku']

function randomDemoWord(): string {
  return DEMO_WORDS[Math.floor(Math.random() * DEMO_WORDS.length)] ?? 'namaskara'
}

function previewLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
}

function StorageMeter() {
  const [estimate, setEstimate] = useState({ usage: 0, quota: 0 })

  useEffect(() => {
    let cancelled = false
    void getStorageEstimate().then((value) => {
      if (!cancelled) setEstimate(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const pct = estimate.quota > 0 ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0
  const tight = pct >= 80

  return (
    <div className="flex items-center gap-2" title="Approximate storage used by this site in your browser">
      <HardDrive size={13} className={tight ? 'text-amber-600' : 'text-ink-400'} />
      <span className={cn('tabular-nums', tight && 'font-medium text-amber-700')}>
        {formatBytes(estimate.usage)} used
      </span>
      <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-ink-200 sm:block">
        <span
          className={cn('block h-full rounded-full', tight ? 'bg-amber-500' : 'bg-brand-500')}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </span>
      {tight ? <span className="text-[10.5px] text-amber-700">Storage nearly full</span> : null}
    </div>
  )
}

function TypingDemo() {
  const [phonetic, setPhonetic] = useState(randomDemoWord)
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() =>
    transliterationService.localSuggestions(phonetic, 4),
  )
  const [mode, setMode] = useState(() => transliterationService.getSettings().mode)

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<TransliterationSettings>).detail
      setMode(detail?.mode ?? transliterationService.getSettings().mode)
    }
    window.addEventListener('kannada-writer:transliteration-settings', handler)
    return () => window.removeEventListener('kannada-writer:transliteration-settings', handler)
  }, [])

  useEffect(() => {
    const word = phonetic.trim().toLowerCase()
    if (!word || !/^[a-z]+$/.test(word) || mode === 'english') {
      setSuggestions([])
      return
    }
    setSuggestions(transliterationService.localSuggestions(word, 4))
  }, [phonetic, mode])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied to clipboard', text)
    } catch {
      toast('Could not copy', 'Select the Kannada text and copy it manually.', 'error')
    }
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          <Sparkles size={12} className="text-brand-600" />
          Try phonetic typing
        </p>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
            mode === 'english' ? 'bg-ink-200 text-ink-600' : 'bg-brand-100 text-brand-800',
          )}
        >
          {mode === 'english' ? 'English only' : 'ಕನ್ನಡ'}
        </span>
      </div>

      <div className="mt-2 flex items-center overflow-hidden rounded-lg border border-ink-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <input
          value={phonetic}
          onChange={(event) => setPhonetic(event.target.value.slice(0, 40))}
          placeholder="Type English phonetics…"
          aria-label="Try phonetic typing"
          spellCheck={false}
          className="h-10 min-w-0 flex-1 bg-transparent px-3 text-[13px] text-ink-900 outline-none"
        />
        <span className="border-l border-ink-200 px-2 text-[10px] uppercase tracking-wide text-ink-400">→</span>
        <span className="max-w-[46%] truncate px-3 font-kannada text-[15px] text-brand-800">
          {suggestions[0]?.text ?? '—'}
        </span>
      </div>

      {suggestions.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.slice(1).map((suggestion) => (
            <button
              key={suggestion.text}
              type="button"
              onClick={() => void copy(suggestion.text)}
              className="rounded-full border border-ink-200 bg-white px-2.5 py-1 font-kannada text-[12.5px] text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50"
              title="Copy this suggestion"
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[10.5px] text-ink-400">
          {mode === 'english'
            ? 'Switch the editor to ಕನ್ನಡ to convert phonetics.'
            : 'Type a phonetic word to see Kannada suggestions.'}
        </p>
      )}
      <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
        Inside the editor, this popup appears under your cursor. Press <kbd className="kw-kbd">Space</kbd> to accept the
        highlighted word, <kbd className="kw-kbd">↑</kbd>/<kbd className="kw-kbd">↓</kbd> to choose.
      </p>
    </div>
  )
}

export function DocumentHome({ onOpenDocument, onCreateDocument }: Props) {
  const {
    documents,
    allDocuments,
    loading,
    query,
    setQuery,
    sort,
    setSort,
    rename,
    remove,
    duplicate,
    busy,
  } = useDocuments()

  const [creating, setCreating] = useState(false)
  const [renameTarget, setRenameTarget] = useState<KannadaDocument | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<KannadaDocument | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importData, setImportData] = useState<unknown>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [importing, setImporting] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const [demoKey, setDemoKey] = useState(0)

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [])

  const totalWords = useMemo(
    () => allDocuments.reduce((sum, doc) => sum + (doc.wordCount || countWords(doc.plainText ?? '')), 0),
    [allDocuments],
  )

  const handleCreate = useCallback(async () => {
    if (creating) return
    setCreating(true)
    try {
      const id = await onCreateDocument()
      if (id) onOpenDocument(id)
    } finally {
      setCreating(false)
    }
  }, [creating, onCreateDocument, onOpenDocument])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === 'n') {
        event.preventDefault()
        void handleCreate()
      } else if (key === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleCreate])

  const openRename = (doc: KannadaDocument) => {
    setRenameTarget(doc)
    setRenameValue(doc.title)
  }

  const submitRename = async () => {
    if (!renameTarget) return
    await rename(renameTarget.id, renameValue)
    setRenameTarget(null)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await remove(deleteTarget.id)
    setDeleteTarget(null)
  }

  const exportBackup = async () => {
    try {
      const backup = await DocumentService.exportBackup()
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBlob(
        new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
        `kannada-writer-backup-${stamp}.json`,
      )
      toast('Backup exported', `${backup.documents.length} document${backup.documents.length === 1 ? '' : 's'} saved.`)
    } catch (error) {
      toast('Backup failed', error instanceof Error ? error.message : undefined, 'error')
    }
  }

  const exportDocumentJson = async (id: string) => {
    const doc = await DocumentService.get(id)
    if (!doc) return
    try {
      const payload = {
        app: 'kannada-writer',
        version: 1,
        exportedAt: new Date().toISOString(),
        document: doc,
      }
      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
        `${sanitizeFilename(doc.title)}.json`,
      )
      toast('Document exported', `${sanitizeFilename(doc.title)}.json`)
    } catch (error) {
      toast('Export failed', error instanceof Error ? error.message : undefined, 'error')
    }
  }

  const pickBackup = () => fileRef.current?.click()

  const handleFile = async (file: File | null) => {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      setImportData(parsed)
      setImportMode('merge')
      setImportOpen(true)
    } catch {
      toast('Not a valid backup', 'Choose a JSON backup created by Kannada Writer.', 'error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const runImport = async () => {
    if (!importData) return
    setImporting(true)
    try {
      const result = await DocumentService.importBackup(importData, importMode)
      setImportOpen(false)
      setImportData(null)
      toast(
        'Backup restored',
        `${result.imported} imported, ${result.skipped} skipped${
          importMode === 'replace' ? ' (existing documents were replaced)' : ''
        }.`,
        result.imported > 0 ? 'success' : 'default',
      )
    } catch (error) {
      toast('Import failed', error instanceof Error ? error.message : undefined, 'error')
    } finally {
      setImporting(false)
    }
  }

  const status = transliterationService.providerStatus

  return (
    <div className="kw-app-bg flex h-full flex-col overflow-hidden">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
      />

      <header className="shrink-0 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm">
              <span className="font-kannada text-[17px] font-semibold leading-none">ಕ</span>
            </div>
            <div className="leading-tight">
              <p className="text-[14px] font-semibold tracking-tight text-ink-900">Kannada Writer</p>
              <p className="font-kannada text-[10.5px] text-ink-400">ಕನ್ನಡ Writer</p>
            </div>
          </div>

          <span className="ml-1 hidden items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-[10px] font-medium text-brand-800 sm:flex">
            <span className={cn('h-1.5 w-1.5 rounded-full', status.onlineReachable ? 'bg-sky-500' : 'bg-brand-500')} />
            {status.mode === 'english' ? 'English typing' : status.onlineReachable ? 'Online + offline' : 'Offline ready'}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Dropdown
              align="end"
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Database size={13} />
                  <span className="hidden sm:inline">Backup</span>
                </Button>
              }
            >
              <DropdownItem onSelect={() => void exportBackup()}>
                <span className="flex items-center gap-2">
                  <Download size={13} /> Export all documents
                </span>
              </DropdownItem>
              <DropdownItem onSelect={pickBackup}>
                <span className="flex items-center gap-2">
                  <Upload size={13} /> Import backup…
                </span>
              </DropdownItem>
            </Dropdown>
            <Button size="sm" className="gap-1.5" onClick={() => void handleCreate()} disabled={creating}>
              {creating ? <FileText size={14} className="animate-pulse" /> : <Plus size={14} />}
              New document
            </Button>
          </div>
        </div>
      </header>

      <main ref={mainRef} className="kw-scroll flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6">
          <section className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
            <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm sm:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">Phonetic Kannada editor</p>
              <h1 className="mt-2 max-w-2xl text-[26px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[32px]">
                Type in English.
                <br />
                <span className="font-kannada text-brand-800">ಬರೆಯಿರಿ ಕನ್ನಡದಲ್ಲಿ.</span>
              </h1>
              <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ink-600">
                A Word-style editor built for Kannada. Type <span className="font-medium text-ink-800">namaskara</span> and
                pick <span className="font-kannada font-medium text-brand-800">ನಮಸ್ಕಾರ</span> — suggestions appear as you
                type, with no separate textbox and no Nudi keyboard mapping.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" className="gap-1.5" onClick={() => void handleCreate()} disabled={creating}>
                  <FilePlus2 size={14} /> Start writing
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDemoKey((key) => key + 1)}>
                  <Sparkles size={13} /> Shuffle example
                </Button>
                <span className="text-[11px] text-ink-400">
                  {allDocuments.length} document{allDocuments.length === 1 ? '' : 's'} · {totalWords.toLocaleString()} words
                </span>
              </div>

              <ul className="mt-5 grid gap-2 text-[11.5px] text-ink-600 sm:grid-cols-3">
                {[
                  ['Offline-first', 'Bundled engine works without internet'],
                  ['Unicode Kannada', 'Copy, search and export real ಕನ್ನಡ text'],
                  ['Private by design', 'Documents stay in this browser'],
                ].map(([title, text]) => (
                  <li key={title} className="rounded-lg border border-ink-200 bg-ink-50/50 px-3 py-2">
                    <p className="flex items-center gap-1.5 font-semibold text-ink-800">
                      <Check size={11} className="text-brand-600" /> {title}
                    </p>
                    <p className="mt-0.5 leading-snug text-ink-500">{text}</p>
                  </li>
                ))}
              </ul>
            </div>

            <TypingDemo key={demoKey} />
          </section>

          <section className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-semibold text-ink-900">
                Your documents
                <span className="ml-1.5 text-[11.5px] font-normal text-ink-400">{documents.length}</span>
              </h2>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title or text…"
                    aria-label="Search documents"
                    className="h-8 w-[210px] rounded-md border border-ink-300 bg-white pl-8 pr-7 text-[12px] text-ink-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-[260px]"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                      aria-label="Clear search"
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </div>

                <div className="relative">
                  <ArrowUpDown size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" />
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortKey)}
                    aria-label="Sort documents"
                    className="h-8 rounded-md border border-ink-300 bg-white pl-7 pr-2 text-[12px] text-ink-700 outline-none focus:border-brand-500"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="mt-8 flex items-center justify-center gap-2 py-16 text-[12px] text-ink-500">
                <Clock3 size={14} className="animate-pulse" /> Loading your documents…
              </div>
            ) : documents.length === 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-white/60 px-6 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  {query ? <Search size={22} /> : <FileText size={22} />}
                </div>
                <p className="mt-3 text-[14px] font-semibold text-ink-900">
                  {query ? 'No documents match your search' : 'No documents yet'}
                </p>
                <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-ink-500">
                  {query
                    ? 'Try a different word, or clear the search to see everything.'
                    : 'Create your first document and start typing English phonetics to write in Kannada.'}
                </p>
                {query ? (
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setQuery('')}>
                    Clear search
                  </Button>
                ) : (
                  <Button size="sm" className="mt-4 gap-1.5" onClick={() => void handleCreate()} disabled={creating}>
                    <Plus size={14} /> New document
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {documents.map((doc) => {
                  const lines = previewLines(doc.plainText ?? '')
                  return (
                    <article
                      key={doc.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenDocument(doc.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onOpenDocument(doc.id)
                        }
                      }}
                      className="kw-doc-card group flex cursor-pointer flex-col overflow-hidden text-left"
                    >
                      <div className="relative flex h-[104px] items-start overflow-hidden border-b border-ink-100 bg-ink-50/40 px-4 py-3">
                        {lines.length ? (
                          <div className="w-full space-y-[5px] font-kannada text-[9.5px] leading-[1.3] text-ink-500">
                            {lines.map((line, index) => (
                              <p key={index} className="truncate">
                                {line}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <div className="w-full space-y-[7px]">
                            <div className="doc-thumb-line w-3/4" />
                            <div className="doc-thumb-line w-11/12" />
                            <div className="doc-thumb-line w-2/3" />
                            <div className="doc-thumb-line w-5/6" />
                          </div>
                        )}
                        <span className="absolute bottom-2 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-400 shadow-sm">
                          A4
                        </span>

                        <div
                          className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Dropdown
                            align="end"
                            trigger={
                              <button
                                type="button"
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-ink-200 bg-white/95 text-ink-600 shadow-sm hover:bg-white"
                                aria-label={`Actions for ${doc.title}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <MoreVertical size={13} />
                              </button>
                            }
                          >
                            <DropdownItem onSelect={() => onOpenDocument(doc.id)}>Open</DropdownItem>
                            <DropdownItem onSelect={() => openRename(doc)}>
                              <span className="flex items-center gap-2">
                                <PencilLine size={13} /> Rename
                              </span>
                            </DropdownItem>
                            <DropdownItem onSelect={() => void duplicate(doc.id)}>
                              <span className="flex items-center gap-2">
                                <Copy size={13} /> Duplicate
                              </span>
                            </DropdownItem>
                            <DropdownItem onSelect={() => void exportDocumentJson(doc.id)}>
                              <span className="flex items-center gap-2">
                                <FileJson size={13} /> Download JSON
                              </span>
                            </DropdownItem>
                            <DropdownSeparator />
                            <DropdownItem danger onSelect={() => setDeleteTarget(doc)}>
                              <span className="flex items-center gap-2">
                                <Trash2 size={13} /> Delete
                              </span>
                            </DropdownItem>
                          </Dropdown>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col px-3 py-2.5">
                        <h3 className="truncate text-[12.5px] font-semibold text-ink-900">{doc.title}</h3>
                        <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-ink-400">
                          <Clock3 size={10} />
                          {relativeTime(doc.updatedAt)}
                          <span aria-hidden>·</span>
                          {(doc.wordCount || 0).toLocaleString()} words
                        </p>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="shrink-0 border-t border-ink-200 bg-white/85 px-4 py-1.5 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10.5px] text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <ArrowDownAZ size={12} className="text-ink-400" />
            Autosaved locally · Export a backup before clearing browser data
          </span>
          <StorageMeter />
        </div>
      </footer>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title="Rename document"
        description="The title is used for the document list and for exported file names."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void submitRename()}>
              Rename
            </Button>
          </>
        }
      >
        <label className="kw-label" htmlFor="rename-title">
          Document name
        </label>
        <input
          id="rename-title"
          className="kw-input"
          value={renameValue}
          autoFocus
          onChange={(event) => setRenameValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submitRename()
          }}
        />
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this document?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” will be removed from this browser. This cannot be undone unless you have a backup.`
            : ''
        }
        confirmLabel={busy ? 'Deleting…' : 'Delete document'}
        danger
        onConfirm={() => void confirmDelete()}
      />

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open)
          if (!open) setImportData(null)
        }}
        title="Restore a backup"
        description="Choose how documents from the backup file should be merged into this browser."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={importing} onClick={() => void runImport()}>
              {importing ? 'Importing…' : importMode === 'replace' ? 'Replace & import' : 'Merge & import'}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setImportMode('merge')}
            className={cn(
              'flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
              importMode === 'merge'
                ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-200'
                : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50',
            )}
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-brand-600">
              {importMode === 'merge' ? <span className="h-2 w-2 rounded-full bg-brand-600" /> : null}
            </span>
            <span>
              <span className="block text-[12.5px] font-semibold text-ink-800">Merge (recommended)</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-500">
                Keeps your current documents. Newer documents from the backup replace older copies with the same ID.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setImportMode('replace')}
            className={cn(
              'flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
              importMode === 'replace'
                ? 'border-red-400 bg-red-50/60 ring-1 ring-red-200'
                : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50',
            )}
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-red-500">
              {importMode === 'replace' ? <span className="h-2 w-2 rounded-full bg-red-500" /> : null}
            </span>
            <span>
              <span className="block text-[12.5px] font-semibold text-ink-800">Replace everything</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-500">
                Permanently removes every document currently stored here, then imports the backup.
              </span>
            </span>
          </button>
        </div>
      </Dialog>
    </div>
  )
}
