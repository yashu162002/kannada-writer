export type PageSize = 'A4' | 'A5' | 'Letter' | 'Legal'

export type PageOrientation = 'portrait' | 'landscape'

export interface PageMargins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface PageSettings {
  size: PageSize
  orientation: PageOrientation
  margins: PageMargins
  /** Vertical gap between rendered page surfaces, in px */
  pageSpacing: number
  showPageBorders: boolean
}

export interface HeaderFooter {
  enabled: boolean
  content: string
}

export interface DocumentMeta {
  /** Document title */
  title: string
  /** Optional subject line for document properties */
  subject?: string
  /** Optional author for document properties */
  author?: string
}

export interface KannadaDocument {
  id: string
  title: string
  /** ProseMirror JSON document serialized as a string */
  content: string
  /** Plain text cache used for previews and search */
  plainText: string
  createdAt: number
  updatedAt: number
  wordCount: number
  characterCount: number
  pageSettings: PageSettings
  preferredFont: string
  preferredFontSize: number
  header: HeaderFooter
  footer: HeaderFooter
  showPageNumbers: boolean
  meta: DocumentMeta
}

export type DocumentListItem = Pick<
  KannadaDocument,
  'id' | 'title' | 'createdAt' | 'updatedAt' | 'wordCount' | 'characterCount' | 'plainText' | 'preferredFont'
>

export interface BackupFile {
  app: 'kannada-writer'
  version: 1
  exportedAt: string
  documents: KannadaDocument[]
  settings?: Record<string, unknown>
  dictionary?: Array<{ phonetic: string; kannada: string; updatedAt: number }>
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface DocumentStats {
  words: number
  characters: number
  charactersNoSpaces: number
  pages: number
}

export interface ViewSettings {
  zoom: number
  showPageBoundaries: boolean
  showRuler: boolean
  focusMode: boolean
  pageView: boolean
}

export const FONT_SIZE_OPTIONS = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 48, 60, 72,
] as const

export const PAGE_DIMENSIONS: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 }, // 210mm x 297mm @96dpi
  A5: { width: 559, height: 794 },
  Letter: { width: 816, height: 1056 },
  Legal: { width: 816, height: 1344 },
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  size: 'A4',
  orientation: 'portrait',
  margins: { top: 72, right: 72, bottom: 72, left: 72 },
  pageSpacing: 28,
  showPageBorders: true,
}
