import type { HeaderFooter, PageSettings } from '@/types/document'

export interface ExportContext {
  title: string
  html: string
  json: Record<string, unknown>
  text: string
  settings: PageSettings
  header: HeaderFooter
  footer: HeaderFooter
  showPageNumbers: boolean
  fontFamily: string
  fontSize: number
  lineHeight: string
  meta: { subject?: string; author?: string; title?: string }
}
