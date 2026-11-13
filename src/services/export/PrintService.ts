import { pageSizeMm } from '@/lib/page'
import { paginateHtml } from './paginate'
import type { ExportContext } from './types'

const PRINT_ROOT_ID = 'kw-print-root'

function getPrintRoot(): HTMLElement {
  let root = document.getElementById(PRINT_ROOT_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = PRINT_ROOT_ID
    root.className = 'kw-print-root'
    document.body.appendChild(root)
  }
  return root
}

export function buildPrintPages(context: ExportContext): HTMLElement[] {
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
  return paginated.pages
}

/**
 * Print using the browser's vector text renderer. Pages are pre-paginated at the
 * exact physical size, so headers, footers, page numbers and margins match the
 * PDF export while text stays selectable and searchable.
 */
export function printDocument(context: ExportContext): void {
  const pages = buildPrintPages(context)
  const root = getPrintRoot()
  root.innerHTML = ''

  const mm = pageSizeMm(context.settings)
  const style = document.createElement('style')
  style.id = 'kw-print-page-style'
  style.textContent = `@page { size: ${mm.width}mm ${mm.height}mm; margin: 0; }`
  document.head.appendChild(style)

  for (const page of pages) {
    page.style.margin = '0'
    page.style.boxShadow = 'none'
    root.appendChild(page)
  }

  const previousTitle = document.title
  document.title = context.title

  const cleanup = () => {
    window.setTimeout(() => {
      root.innerHTML = ''
      style.remove()
      document.title = previousTitle
    }, 400)
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)

  window.setTimeout(() => {
    window.print()
    // Safari does not fire afterprint reliably
    window.setTimeout(() => {
      if (root.childElementCount) {
        root.innerHTML = ''
        style.remove()
        document.title = previousTitle
      }
    }, 6000)
  }, 120)
}
