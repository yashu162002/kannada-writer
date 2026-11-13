import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import CharacterCount from '@tiptap/extension-character-count'
import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileDown,
  FileText,
  Loader2,
  MoreHorizontal,
  Printer,
  Save,
  Sparkles,
  X,
} from 'lucide-react'

import { useDocument } from '@/hooks/useDocuments'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useKannadaTyping } from '@/hooks/useKannadaTyping'
import { DocumentService, countWords } from '@/services/storage/DocumentService'
import { transliterationService } from '@/services/transliteration/TransliterationService'
import { DEFAULT_PAGE_SETTINGS, type KannadaDocument, type PageSettings, type ViewSettings } from '@/types/document'
import { FontSizeExtension } from '@/extensions/FontSizeExtension'
import { LineHeightExtension } from '@/extensions/LineHeightExtension'
import { PageBreakExtension } from '@/extensions/PageBreakExtension'
import { ResizableImageExtension } from '@/extensions/ImageExtension'
import { PageRenderer } from './PageRenderer'
import { EditorToolbar } from './EditorToolbar'
import { InsertRibbon } from './InsertRibbon'
import { LayoutRibbon } from './LayoutRibbon'
import { ViewRibbon } from './ViewRibbon'
import { FileRibbon, type ExportFormat } from './FileRibbon'
import { SuggestionPopup } from './SuggestionPopup'
import { ModeSelector } from '@/components/transliteration/ModeSelector'
import { StatusBar } from '@/components/common/StatusBar'
import { Dialog } from '@/components/common/Dialog'
import { Button } from '@/components/common/Button'
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/common/Dropdown'
import { toast } from '@/components/common/Toast'
import { FindReplaceDialog } from './FindReplaceDialog'
import { PrintPreview } from './PrintPreview'
import { PropertiesDialog } from './EditorDialogs'
import { exportPdf } from '@/services/export/PdfService'
import { buildDocx } from '@/services/export/DocxService'
import { buildHtml, buildRtf, buildTxt } from '@/services/export/TextService'
import { buildOdt } from '@/services/export/OdtService'
import { printDocument } from '@/services/export/PrintService'
import type { ExportContext } from '@/services/export/types'
import { downloadBlob, formatDateTime, isEditableTarget, sanitizeFilename } from '@/lib/utils'
import { getFontStack } from '@/lib/fonts'
import { cn } from '@/lib/utils'

const VIEW_STORAGE_KEY = 'kannada-writer.view-settings'

const DEFAULT_VIEW: ViewSettings = {
  zoom: 100,
  showPageBoundaries: true,
  showRuler: true,
  focusMode: false,
  pageView: true,
}

type RibbonTab = 'home' | 'insert' | 'layout' | 'view' | 'file'

function loadViewSettings(): ViewSettings {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY)
    if (raw) return { ...DEFAULT_VIEW, ...(JSON.parse(raw) as Partial<ViewSettings>) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_VIEW }
}

function parseContent(content: string) {
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') return parsed
  } catch {
    /* ignore */
  }
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

interface Props {
  documentId: string
  onBack: () => void
  onOpenDocument: (id: string) => void
  onNewDocument: () => void
}

export function DocumentEditor({ documentId, onBack, onOpenDocument, onNewDocument }: Props) {
  const { doc, loading, error } = useDocument(documentId)
  const [recovery, setRecovery] = useState<{ content: string; savedAt: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!doc) return
    void DocumentService.getRecovery(doc.id).then((snapshot) => {
      if (cancelled || !snapshot) return
      if (snapshot.content && snapshot.content !== doc.content && snapshot.savedAt > doc.updatedAt + 1500) {
        setRecovery({ content: snapshot.content, savedAt: snapshot.savedAt })
      }
    })
    return () => {
      cancelled = true
    }
  }, [doc])

  if (loading) {
    return (
      <div className="kw-app-bg flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-[13px] text-ink-500">
          <Loader2 size={16} className="animate-spin" /> Opening document…
        </div>
      </div>
    )
  }

  if (!doc || error) {
    return (
      <div className="kw-app-bg flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[14px] font-medium text-ink-800">{error ?? 'Document not found'}</p>
        <Button size="sm" onClick={onBack}>
          Back to documents
        </Button>
      </div>
    )
  }

  return (
    <EditorWorkspace
      key={doc.id}
      doc={doc}
      recovery={recovery}
      onDismissRecovery={() => setRecovery(null)}
      onBack={onBack}
      onOpenDocument={onOpenDocument}
      onNewDocument={onNewDocument}
    />
  )
}

function EditorWorkspace({
  doc,
  recovery,
  onDismissRecovery,
  onBack,
  onOpenDocument,
  onNewDocument,
}: {
  doc: KannadaDocument
  recovery: { content: string; savedAt: number } | null
  onDismissRecovery: () => void
  onBack: () => void
  onOpenDocument: (id: string) => void
  onNewDocument: () => void
}) {
  const [title, setTitle] = useState(doc.title)
  const [pageSettings, setPageSettings] = useState<PageSettings>(doc.pageSettings ?? DEFAULT_PAGE_SETTINGS)
  const [preferredFont, setPreferredFont] = useState(doc.preferredFont || 'Noto Sans Kannada')
  const [preferredFontSize, setPreferredFontSize] = useState(doc.preferredFontSize || 14)
  const [header, setHeader] = useState(doc.header ?? { enabled: false, content: '' })
  const [footer, setFooter] = useState(doc.footer ?? { enabled: false, content: '' })
  const [showPageNumbers, setShowPageNumbers] = useState(Boolean(doc.showPageNumbers))
  const [metaSubject, setMetaSubject] = useState(doc.meta?.subject ?? '')
  const [metaAuthor, setMetaAuthor] = useState(doc.meta?.author ?? '')
  const [view, setView] = useState<ViewSettings>(() => {
    const stored = loadViewSettings()
    if (typeof window !== 'undefined' && window.innerWidth < 900 && stored.zoom === 100) {
      return { ...stored, zoom: 75, showRuler: false }
    }
    return stored
  })
  const [activeTab, setActiveTab] = useState<RibbonTab>('home')
  const [pageCount, setPageCount] = useState(1)
  const [stats, setStats] = useState({ words: doc.wordCount || 0, characters: doc.characterCount || 0 })
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [saveAsTitle, setSaveAsTitle] = useState(doc.title)
  const [findOpen, setFindOpen] = useState(false)
  const [findMode, setFindMode] = useState<'find' | 'replace'>('find')
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  const [printContext, setPrintContext] = useState<ExportContext | null>(null)
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [exporting, setExporting] = useState<{ format: ExportFormat; current: number; total: number } | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyHandlerRef = useRef<(view: unknown, event: KeyboardEvent) => boolean>(() => false)
  const pasteHandlerRef = useRef<(event: ClipboardEvent) => boolean>(() => false)
  const dropHandlerRef = useRef<(event: DragEvent) => boolean>(() => false)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        history: { depth: 300 },
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily.configure({ types: ['textStyle'] }),
      FontSizeExtension,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Superscript,
      Subscript,
      Placeholder.configure({
        placeholder: 'Start typing in English — for example: namaskara, nanna hesaru…',
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      ResizableImageExtension,
      Table.configure({ resizable: true, lastColumnResizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
      LineHeightExtension,
      PageBreakExtension,
    ],
    content: parseContent(doc.content),
    autofocus: false,
    editorProps: {
      attributes: {
        class: 'kw-editor-content',
        spellcheck: 'false',
        'data-gramm': 'false',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Kannada document',
      },
      handleKeyDown: (_view, event) => keyHandlerRef.current(_view, event),
      handlePaste: (_view, event) => pasteHandlerRef.current(event),
      handleDrop: (_view, event) => dropHandlerRef.current(event),
    },
    onUpdate: ({ editor: instance }) => {
      if (statsTimer.current) clearTimeout(statsTimer.current)
      statsTimer.current = setTimeout(() => {
        const text = instance.getText({ blockSeparator: '\n' })
        setStats({ words: countWords(text), characters: text.length })
      }, 250)
    },
  })

  editorRef.current = editor

  const typing = useKannadaTyping(editor)
  useEffect(() => {
    keyHandlerRef.current = typing.handleKeyDown
  }, [typing.handleKeyDown])

  const { saveState, lastSavedAt, saveNow } = useAutoSave({
    editor,
    documentId: doc.id,
    onSaved: () => undefined,
  })

  const persist = useCallback(
    async (patch: Partial<KannadaDocument>) => {
      try {
        await DocumentService.update(doc.id, patch)
      } catch (error) {
        toast('Could not save settings', error instanceof Error ? error.message : undefined, 'error')
      }
    },
    [doc.id],
  )

  // image paste / drop
  useEffect(() => {
    const handleImageFile = (file: File) => {
      if (!file.type.startsWith('image/')) return
      if (file.size > 8 * 1024 * 1024) {
        toast('Image too large', 'Choose an image smaller than 8 MB.', 'error')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const src = String(reader.result)
        editorRef.current?.chain().focus().setImage({ src }).run()
      }
      reader.readAsDataURL(file)
    }

    pasteHandlerRef.current = (event) => {
      const files = Array.from(event.clipboardData?.files ?? [])
      const image = files.find((file) => file.type.startsWith('image/'))
      if (!image) return false
      event.preventDefault()
      handleImageFile(image)
      return true
    }

    dropHandlerRef.current = (event) => {
      const files = Array.from(event.dataTransfer?.files ?? [])
      const image = files.find((file) => file.type.startsWith('image/'))
      if (!image) return false
      event.preventDefault()
      handleImageFile(image)
      return true
    }
  }, [])

  useEffect(() => {
    document.title = title.trim() ? `${title.trim()} — Kannada Writer` : 'Kannada Writer'
    return () => {
      document.title = 'Kannada Writer'
    }
  }, [title])

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(view))
    } catch {
      /* ignore */
    }
  }, [view])

  const updateTitle = (value: string) => {
    setTitle(value)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => {
      const clean = value.trim() || 'Untitled document'
      void persist({ title: clean, meta: { ...doc.meta, title: clean, subject: metaSubject, author: metaAuthor } })
    }, 350)
  }

  const updatePageSettings = (next: PageSettings) => {
    setPageSettings(next)
    void persist({ pageSettings: next })
  }

  const updateHeader = (next: typeof header) => {
    setHeader(next)
    void persist({ header: next })
  }

  const updateFooter = (next: typeof footer) => {
    setFooter(next)
    void persist({ footer: next })
  }

  const updateShowPageNumbers = (next: boolean) => {
    setShowPageNumbers(next)
    void persist({ showPageNumbers: next })
  }

  const updateFont = (font: string) => {
    setPreferredFont(font)
    void persist({ preferredFont: font })
  }

  const updateFontSize = (size: number) => {
    setPreferredFontSize(size)
    void persist({ preferredFontSize: size })
  }

  const makeContext = useCallback((): ExportContext | null => {
    if (!editor) return null
    return {
      title: title.trim() || 'Untitled document',
      html: editor.getHTML(),
      json: editor.getJSON() as unknown as Record<string, unknown>,
      text: editor.getText({ blockSeparator: '\n' }),
      settings: pageSettings,
      header,
      footer,
      showPageNumbers,
      fontFamily: preferredFont,
      fontSize: preferredFontSize,
      lineHeight: '1.75',
      meta: { subject: metaSubject, author: metaAuthor, title },
    }
  }, [
    editor,
    title,
    pageSettings,
    header,
    footer,
    showPageNumbers,
    preferredFont,
    preferredFontSize,
    metaSubject,
    metaAuthor,
  ])

  const download = (blob: Blob, extension: string) => {
    downloadBlob(blob, `${sanitizeFilename(title)}.${extension}`)
  }

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      const context = makeContext()
      if (!context) return
      try {
        if (format === 'docx') {
          setExporting({ format, current: 0, total: 0 })
          download(await buildDocx(context), 'docx')
          toast('DOCX exported', 'Kannada Unicode, fonts, tables and images preserved.')
        } else if (format === 'pdf') {
          setPdfBusy(true)
          setExporting({ format, current: 0, total: 1 })
          const blob = await exportPdf(context, (current, total) => setExporting({ format, current, total }))
          download(blob, 'pdf')
          toast('PDF exported', `${context.settings.size} pages with Kannada fonts embedded as rendered pages.`)
        } else if (format === 'txt') {
          download(new Blob([buildTxt(context)], { type: 'text/plain;charset=utf-8' }), 'txt')
          toast('TXT exported')
        } else if (format === 'html') {
          download(new Blob([await buildHtml(context)], { type: 'text/html;charset=utf-8' }), 'html')
          toast('HTML exported', 'The Kannada font is embedded in the file.')
        } else if (format === 'rtf') {
          download(new Blob([buildRtf(context)], { type: 'application/rtf;charset=utf-8' }), 'rtf')
          toast('RTF exported')
        } else if (format === 'odt') {
          download(await buildOdt(context), 'odt')
          toast('ODT exported')
        } else if (format === 'json') {
          const payload = {
            app: 'kannada-writer',
            version: 1,
            title: context.title,
            exportedAt: new Date().toISOString(),
            content: context.json,
            pageSettings,
            header,
            footer,
            showPageNumbers,
            preferredFont,
            preferredFontSize,
            meta: { subject: metaSubject, author: metaAuthor },
          }
          download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'json')
          toast('Document JSON exported')
        }
      } catch (error) {
        toast('Export failed', error instanceof Error ? error.message : 'Unknown export error', 'error')
      } finally {
        setExporting(null)
        setPdfBusy(false)
      }
    },
    [
      makeContext,
      title,
      pageSettings,
      header,
      footer,
      showPageNumbers,
      preferredFont,
      preferredFontSize,
      metaSubject,
      metaAuthor,
    ],
  )

  const openPrintPreview = () => {
    const context = makeContext()
    if (!context) return
    setPrintContext(context)
    setPrintPreviewOpen(true)
  }

  const handlePrint = () => {
    const context = makeContext()
    if (!context) return
    printDocument(context)
  }

  const handleSaveAs = async () => {
    const clean = saveAsTitle.trim() || 'Untitled document'
    if (!editor) return
    const text = editor.getText({ blockSeparator: '\n' })
    const created = await DocumentService.create({
      title: clean,
      content: JSON.stringify(editor.getJSON()),
      pageSettings,
      preferredFont,
      preferredFontSize,
    })
    await DocumentService.update(created.id, {
      header,
      footer,
      showPageNumbers,
      meta: { title: clean, subject: metaSubject, author: metaAuthor },
      plainText: text,
      wordCount: countWords(text),
      characterCount: text.length,
    })
    setSaveAsOpen(false)
    toast('Saved as a new document', clean)
    onOpenDocument(created.id)
  }

  const handleNew = async () => {
    await saveNow()
    onNewDocument()
  }

  const handleBack = async () => {
    await saveNow()
    onBack()
  }

  const restoreRecovery = () => {
    if (!recovery || !editor) return
    try {
      editor.commands.setContent(parseContent(recovery.content))
      toast('Recovery restored', 'Saving the recovered content…')
      void saveNow()
      onDismissRecovery()
    } catch {
      toast('Could not restore recovery', 'The snapshot is not valid document data.', 'error')
    }
  }

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        if (event.shiftKey) {
          setSaveAsTitle(title)
          setSaveAsOpen(true)
        } else {
          void saveNow()
          toast('Saved to this browser')
        }
        return
      }
      if (key === 'n') {
        event.preventDefault()
        void handleNew()
        return
      }
      if (key === 'o') {
        event.preventDefault()
        void handleBack()
        return
      }
      if (key === 'p') {
        event.preventDefault()
        handlePrint()
        return
      }
      if (key === 'f') {
        event.preventDefault()
        setFindMode('find')
        setFindOpen(true)
        return
      }
      if (key === 'h') {
        event.preventDefault()
        setFindMode('replace')
        setFindOpen(true)
        return
      }
      if (key === 'a' && isEditableTarget(event.target)) {
        // allow native select-all inside inputs
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveNow, title, handleNew, handleBack])

  const tabs: Array<{ id: RibbonTab; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'insert', label: 'Insert' },
    { id: 'layout', label: 'Layout' },
    { id: 'view', label: 'View' },
    { id: 'file', label: 'File' },
  ]

  const lastSavedLabel = lastSavedAt ? `Saved ${formatDateTime(lastSavedAt)}` : 'Not saved yet'
  const modeLabel =
    typing.settings.mode === 'english'
      ? 'English typing'
      : typing.settings.mode === 'offline'
        ? 'Kannada · offline'
        : typing.settings.mode === 'online'
          ? 'Kannada · online'
          : 'Kannada · automatic'

  return (
    <div className={cn('kw-app-bg flex h-full flex-col overflow-hidden', view.focusMode && 'kw-focus-mode')}>
      {recovery ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">
          <span>
            <strong>Recovery found.</strong> Unsaved content from {formatDateTime(recovery.savedAt)} is available.
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={restoreRecovery}
              className="rounded border border-amber-400 bg-white px-2 py-1 font-medium hover:bg-amber-100"
            >
              Restore
            </button>
            <button type="button" onClick={onDismissRecovery} className="rounded p-1 hover:bg-amber-100" aria-label="Dismiss">
              <X size={13} />
            </button>
          </span>
        </div>
      ) : null}

      {/* Document header */}
      <header className="kw-doc-header flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-200 bg-white px-2.5 py-2 sm:px-3">
        <button
          type="button"
          onClick={() => void handleBack()}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-ink-100"
          title="Back to all documents"
        >
          <ArrowLeft size={17} />
        </button>

        <div className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white">
          <span className="font-kannada text-[15px] font-semibold leading-none">ಕ</span>
        </div>

        <div className="min-w-0 flex-1 sm:flex-none sm:min-w-[180px]">
          <input
            value={title}
            onChange={(event) => updateTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
            className="h-7 w-full max-w-[520px] truncate rounded border border-transparent bg-transparent px-1 text-[13.5px] font-semibold text-ink-900 outline-none hover:border-ink-200 focus:border-brand-400 focus:bg-white"
            aria-label="Document title"
          />
          <div className="flex items-center gap-2 px-1 text-[9.5px] text-ink-400">
            <span className="inline-flex items-center gap-1">
              {saveState === 'saving' ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />}
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'dirty'
                  ? 'Unsaved'
                  : saveState === 'error'
                    ? 'Save failed'
                    : lastSavedLabel}
            </span>
            <span className="hidden sm:inline">· Auto-saved locally</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 md:flex">
            <ModeSelector />
          </div>
          <button
            type="button"
            onClick={() => {
              setSaveAsTitle(title)
              setSaveAsOpen(true)
            }}
            className="hidden h-8 items-center gap-1 rounded-md border border-ink-300 bg-white px-2 text-[11.5px] font-medium text-ink-700 hover:bg-ink-50 sm:flex"
            title="Save a copy"
          >
            Save as
          </button>
          <button
            type="button"
            onClick={() => void saveNow()}
            className="flex h-8 items-center gap-1 rounded-md bg-brand-600 px-2.5 text-[11.5px] font-medium text-white hover:bg-brand-700"
            title="Save (Ctrl+S)"
          >
            <Save size={13} />
            Save
          </button>

          <Dropdown
            align="end"
            trigger={
              <button
                type="button"
                className="flex h-8 items-center gap-1 rounded-md bg-ink-900 px-2.5 text-[11.5px] font-medium text-white hover:bg-ink-800"
                title="Download"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Download</span>
                <ChevronDown size={11} />
              </button>
            }
          >
            <DropdownItem onSelect={() => void handleExport('docx')} shortcut=".docx">
              <span className="flex items-center gap-2">
                <FileText size={13} /> Word document
              </span>
            </DropdownItem>
            <DropdownItem onSelect={() => void handleExport('pdf')} shortcut=".pdf">
              <span className="flex items-center gap-2">
                <FileDown size={13} /> PDF document
              </span>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={() => void handleExport('html')}>HTML page</DropdownItem>
            <DropdownItem onSelect={() => void handleExport('rtf')}>Rich text (RTF)</DropdownItem>
            <DropdownItem onSelect={() => void handleExport('txt')}>Plain text</DropdownItem>
            <DropdownItem onSelect={() => void handleExport('odt')}>OpenDocument (ODT)</DropdownItem>
            <DropdownItem onSelect={() => void handleExport('json')}>Document JSON</DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={handlePrint}>
              <span className="flex items-center gap-2">
                <Printer size={13} /> Print / Save as PDF
              </span>
            </DropdownItem>
            <DropdownItem onSelect={openPrintPreview}>Print preview</DropdownItem>
          </Dropdown>

          <Dropdown
            align="end"
            trigger={
              <button
                type="button"
                className="flex h-8 w-7 items-center justify-center rounded-md text-ink-600 hover:bg-ink-100"
                aria-label="More actions"
              >
                <MoreHorizontal size={16} />
              </button>
            }
          >
            <DropdownItem onSelect={onNewDocument}>New document</DropdownItem>
            <DropdownItem onSelect={() => void handleBack()}>Open document</DropdownItem>
            <DropdownItem onSelect={() => setPropertiesOpen(true)}>Document properties</DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={openPrintPreview}>Print preview</DropdownItem>
            <DropdownItem onSelect={handlePrint}>Print</DropdownItem>
          </Dropdown>
        </div>
      </header>

      <div className="flex items-center justify-between gap-2 border-b border-ink-200 bg-white px-2 py-1.5 md:hidden">
        <ModeSelector compact />
        <span className="text-[9.5px] text-ink-400">Phonetic Kannada typing</span>
      </div>

      {/* Ribbon */}
      <div className="kw-ribbon shrink-0">
        <div className="kw-ribbon-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="kw-ribbon-tab"
              data-active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto hidden items-center gap-1.5 pb-1 pr-1 lg:flex">
            <div className="flex h-6 items-center gap-1 rounded-full bg-brand-50 px-2 text-[9.5px] font-medium text-brand-800">
              <Sparkles size={10} />
              Type English → get ಕನ್ನಡ
            </div>
          </div>
        </div>

        <div className="min-h-[86px] overflow-hidden">
          {activeTab === 'home' ? (
            <EditorToolbar
              editor={editor}
              defaultFont={preferredFont}
              defaultFontSize={preferredFontSize}
              onDefaultFontChange={updateFont}
              onDefaultFontSizeChange={updateFontSize}
            />
          ) : null}
          {activeTab === 'insert' ? (
            <InsertRibbon
              editor={editor}
              header={header}
              footer={footer}
              showPageNumbers={showPageNumbers}
              onHeaderChange={updateHeader}
              onFooterChange={updateFooter}
              onShowPageNumbersChange={updateShowPageNumbers}
            />
          ) : null}
          {activeTab === 'layout' ? <LayoutRibbon settings={pageSettings} onChange={updatePageSettings} /> : null}
          {activeTab === 'view' ? (
            <ViewRibbon view={view} onChange={setView} onPrintPreview={openPrintPreview} />
          ) : null}
          {activeTab === 'file' ? (
            <FileRibbon
              onNew={() => void handleNew()}
              onOpen={() => void handleBack()}
              onSave={() => void saveNow().then(() => toast('Saved to this browser'))}
              onSaveAs={() => {
                setSaveAsTitle(title)
                setSaveAsOpen(true)
              }}
              onExport={(format) => void handleExport(format)}
              onPrint={handlePrint}
              onPrintPreview={openPrintPreview}
              onProperties={() => setPropertiesOpen(true)}
              onFindReplace={() => {
                setFindMode('replace')
                setFindOpen(true)
              }}
              onBack={() => void handleBack()}
              saveState={saveState}
              lastSavedLabel={lastSavedLabel}
            />
          ) : null}
        </div>
      </div>

      {view.focusMode ? (
        <button
          type="button"
          onClick={() => setView({ ...view, focusMode: false })}
          className="fixed right-4 top-4 z-30 rounded-full border border-ink-300 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-ink-700 shadow-md backdrop-blur hover:bg-white"
        >
          Exit focus mode
        </button>
      ) : null}

      <PageRenderer
        editor={editor}
        settings={pageSettings}
        zoom={view.zoom}
        showPageBoundaries={view.showPageBoundaries && view.pageView}
        showRuler={view.showRuler}
        header={header}
        footer={footer}
        showPageNumbers={showPageNumbers}
        title={title}
        fontFamily={getFontStack(preferredFont)}
        fontSize={(preferredFontSize * 96) / 72}
        lineHeight="1.75"
        scrollRef={scrollRef}
        onPageCountChange={setPageCount}
        focusMode={view.focusMode}
      />

      <StatusBar
        words={stats.words}
        characters={stats.characters}
        pages={pageCount}
        zoom={view.zoom}
        onZoomChange={(zoom) => setView({ ...view, zoom })}
        saveState={saveState}
        lastSavedLabel={lastSavedLabel}
        kanndaMode={modeLabel}
      />

      {typing.popup && typing.settings.showSuggestions ? (
        <SuggestionPopup
          editor={editor}
          popup={typing.popup}
          onSelect={typing.selectSuggestion}
          onClose={typing.closePopup}
          autoConvert={typing.settings.autoConvert}
        />
      ) : null}

      <FindReplaceDialog open={findOpen} onOpenChange={setFindOpen} editor={editor} initialMode={findMode} />

      <PrintPreview
        open={printPreviewOpen}
        onClose={() => setPrintPreviewOpen(false)}
        context={printContext}
        onPrint={() => {
          if (printContext) {
            printDocument(printContext)
          }
        }}
        onDownloadPdf={() => void handleExport('pdf')}
        pdfBusy={pdfBusy}
      />

      <PropertiesDialog
        open={propertiesOpen}
        onOpenChange={setPropertiesOpen}
        title={title}
        onTitleChange={(next) => {
          setTitle(next)
          void persist({ title: next, meta: { ...doc.meta, title: next, subject: metaSubject, author: metaAuthor } })
        }}
        subject={metaSubject}
        author={metaAuthor}
        onChangeMeta={({ subject, author }) => {
          setMetaSubject(subject)
          setMetaAuthor(author)
          void persist({ meta: { title, subject, author } })
        }}
        createdAt={doc.createdAt}
        updatedAt={lastSavedAt ?? doc.updatedAt}
        words={stats.words}
        characters={stats.characters}
        pages={pageCount}
        font={preferredFont}
      />

      <Dialog
        open={saveAsOpen}
        onOpenChange={setSaveAsOpen}
        title="Save as new document"
        description="Creates a separate local copy. Your current document stays unchanged."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSaveAsOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleSaveAs()}>
              Save copy
            </Button>
          </>
        }
      >
        <label className="kw-label" htmlFor="save-as-title">
          Document name
        </label>
        <input
          id="save-as-title"
          className="kw-input"
          value={saveAsTitle}
          autoFocus
          onChange={(event) => setSaveAsTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleSaveAs()
          }}
        />
      </Dialog>

      {exporting ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink-900/45">
          <div className="flex min-w-[260px] flex-col items-center gap-3 rounded-xl bg-white px-6 py-5 shadow-2xl">
            <Loader2 size={22} className="animate-spin text-brand-600" />
            <p className="text-[13px] font-medium text-ink-900">
              {exporting.format === 'pdf' ? 'Building PDF…' : 'Preparing document…'}
            </p>
            <p className="text-[11px] text-ink-500">
              {exporting.total > 0
                ? `Page ${Math.min(exporting.current, exporting.total)} of ${exporting.total}`
                : 'Shaping Kannada text…'}
            </p>
            {exporting.total > 1 ? (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${(exporting.current / exporting.total) * 100}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
