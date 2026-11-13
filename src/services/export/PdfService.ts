import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas-pro'
import { paginateHtml } from './paginate'
import { getPageMetrics, pageSizeMm } from '@/lib/page'
import type { ExportContext } from './types'

const RENDER_HOST_ID = 'kw-pdf-render-host'

function ensureRenderHost(): HTMLElement {
  const existing = document.getElementById(RENDER_HOST_ID)
  if (existing) return existing
  const host = document.createElement('div')
  host.id = RENDER_HOST_ID
  host.style.position = 'fixed'
  host.style.left = '-22000px'
  host.style.top = '0'
  host.style.background = '#ffffff'
  host.style.zIndex = '-1'
  host.style.pointerEvents = 'none'
  document.body.appendChild(host)
  return host
}

/**
 * PDF export.
 *
 * The page DOM is rasterised at 2× into a jsPDF document. This guarantees that
 * Kannada grapheme clusters, gunithakshara and ottakshara are shaped by the
 * browser's text engine exactly as on screen. The output is a real multi-page
 * PDF with A4/Letter/A5/Legal dimensions, correct margins, headers/footers,
 * page numbers, tables and images.
 *
 * For selectable text use "Print preview → Print → Save as PDF", which prints
 * vector HTML text instead.
 */
export async function exportPdf(
  context: ExportContext,
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  await document.fonts?.ready?.catch?.(() => undefined)

  const paginated = paginateHtml({
    html: context.html,
    settings: context.settings,
    title: context.title,
    header: context.header,
    footer: context.footer,
    showPageNumbers: context.showPageNumbers,
    fontFamily: context.fontFamily,
    fontSize: context.fontSize,
    lineHeight: context.lineHeight,
  })

  const host = ensureRenderHost()
  host.innerHTML = ''
  const staging = document.createElement('div')
  staging.style.background = '#ffffff'
  for (const page of paginated.pages) {
    page.style.boxShadow = 'none'
    page.style.margin = '0'
    staging.appendChild(page)
  }
  host.appendChild(staging)

  const metrics = getPageMetrics(context.settings)
  const mm = pageSizeMm(context.settings)
  const orientation = metrics.pageWidth > metrics.pageHeight ? 'landscape' : 'portrait'

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [mm.width, mm.height],
    compress: true,
  })
  pdf.setProperties({
    title: context.title,
    subject: context.meta.subject ?? '',
    author: context.meta.author ?? 'Kannada Writer',
    creator: 'Kannada Writer',
  })

  try {
    const total = paginated.pages.length
    for (let index = 0; index < total; index++) {
      const page = paginated.pages[index]
      onProgress?.(index + 1, total)
      const canvas = await html2canvas(page, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: metrics.pageWidth,
        height: metrics.pageHeight,
        windowWidth: metrics.pageWidth,
        windowHeight: metrics.pageHeight,
      })
      const image = canvas.toDataURL('image/jpeg', 0.94)
      if (index > 0) pdf.addPage([mm.width, mm.height], orientation)
      pdf.addImage(image, 'JPEG', 0, 0, mm.width, mm.height, undefined, 'FAST')
    }
    return pdf.output('blob')
  } finally {
    host.innerHTML = ''
  }
}
