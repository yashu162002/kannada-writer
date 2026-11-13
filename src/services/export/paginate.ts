import type { HeaderFooter, PageSettings } from '@/types/document'
import { getPageMetrics } from '@/lib/page'

export interface PaginateOptions {
  html: string
  settings: PageSettings
  title: string
  header: HeaderFooter
  footer: HeaderFooter
  showPageNumbers: boolean
  fontFamily: string
  fontSize: number
  lineHeight: string
}

export interface PaginatedDocument {
  pages: HTMLElement[]
  pageCount: number
  cleanup: () => void
}

const HEADER_HEIGHT = 34
const FOOTER_HEIGHT = 34

function resolveTokens(template: string, page: number, total: number, title: string): string {
  return template
    .replaceAll('{page}', String(page))
    .replaceAll('{pages}', total ? String(total) : '{pages}')
    .replaceAll('{title}', title)
    .replaceAll('{date}', new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date()))
}

function buildPageShell(
  options: PaginateOptions,
  pageNumber: number,
  totalPages: number,
  reservedHeader: boolean,
  reservedFooter: boolean,
): { page: HTMLElement; content: HTMLElement } {
  const metrics = getPageMetrics(options.settings)
  const page = document.createElement('div')
  page.className = 'kw-page kw-page--print'
  page.style.width = `${metrics.pageWidth}px`
  page.style.height = `${metrics.pageHeight}px`
  page.style.padding = `${metrics.paddingTop}px ${metrics.paddingRight}px ${metrics.paddingBottom}px ${metrics.paddingLeft}px`
  page.dataset.pageNumber = String(pageNumber)
  page.style.fontFamily = options.fontFamily
  page.style.fontSize = `${options.fontSize}px`
  page.style.lineHeight = options.lineHeight
  page.style.color = '#161a1f'

  if (reservedHeader) {
    const header = document.createElement('div')
    header.className = 'kw-page-header-bar'
    header.style.minHeight = `${HEADER_HEIGHT - 14}px`
    const text = document.createElement('span')
    text.style.flex = '1'
    text.textContent = resolveTokens(options.header.content, pageNumber, totalPages, options.title)
    header.appendChild(text)
    if (options.showPageNumbers && !/\{page\}/.test(options.header.content) && !reservedFooter) {
      const num = document.createElement('span')
      num.textContent = String(pageNumber)
      num.className = 'kw-page-page-number'
      header.appendChild(num)
    }
    page.appendChild(header)
  }

  const content = document.createElement('div')
  content.className = 'kw-page-content kw-editor-content'
  content.style.fontFamily = options.fontFamily
  content.style.fontSize = `${options.fontSize}px`
  content.style.lineHeight = options.lineHeight
  page.appendChild(content)

  if (reservedFooter) {
    const footer = document.createElement('div')
    footer.className = 'kw-page-footer-bar'
    footer.style.minHeight = `${FOOTER_HEIGHT - 14}px`
    const text = document.createElement('span')
    text.style.flex = '1'
    text.textContent = resolveTokens(options.footer.content, pageNumber, totalPages, options.title)
    footer.appendChild(text)
    if (options.showPageNumbers && !/\{page\}/.test(options.footer.content)) {
      const num = document.createElement('span')
      num.textContent = String(pageNumber)
      num.className = 'kw-page-page-number'
      footer.appendChild(num)
    }
    page.appendChild(footer)
  }

  return { page, content }
}

function truncateText(root: Node, count: number): void {
  let remaining = count
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    if (remaining <= 0) {
      node.data = ''
      continue
    }
    if (node.data.length <= remaining) {
      remaining -= node.data.length
    } else {
      node.data = node.data.slice(0, remaining)
      remaining = 0
    }
  }
}

function dropText(root: Node, count: number): void {
  let remaining = count
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    if (remaining <= 0) return
    if (node.data.length <= remaining) {
      remaining -= node.data.length
      node.data = ''
    } else {
      node.data = node.data.slice(remaining)
      remaining = 0
    }
  }
}

let segmenter: Intl.Segmenter | null | undefined
function graphemeBoundary(text: string, index: number): number {
  if (index <= 0) return 0
  if (index >= text.length) return text.length
  if (segmenter === undefined) {
    try {
      segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    } catch {
      segmenter = null
    }
  }
  if (!segmenter) return index
  let previous = 0
  for (const { index: start } of segmenter.segment(text)) {
    if (start > index) return previous
    previous = start
  }
  return text.length
}

/**
 * Split a block at a word boundary that is also a grapheme boundary, so Kannada
 * conjunct characters are never broken across pages.
 */
function splitBlockAt(block: HTMLElement, maxHeight: number, measure: (node: HTMLElement) => number) {
  const text = block.textContent ?? ''
  if (!text.trim()) return null
  let lo = 0
  let hi = text.length
  let best = 0
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const boundary = graphemeBoundary(text, mid)
    const clone = block.cloneNode(true) as HTMLElement
    truncateText(clone, boundary)
    if (measure(clone) <= maxHeight) {
      best = boundary
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (best <= 0) return null
  // Prefer ending on a space (but never retreat more than 24 characters)
  const searchStart = Math.max(0, best - 24)
  const slice = text.slice(searchStart, best)
  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace > 0) {
    const candidate = graphemeBoundary(text, searchStart + lastSpace)
    if (candidate > best * 0.5) best = candidate
  }
  if (best >= text.length || !text.slice(0, best).trim()) return null

  const head = block.cloneNode(true) as HTMLElement
  truncateText(head, best)
  const tail = block.cloneNode(true) as HTMLElement
  dropText(tail, best)
  // strip leading spaces from the remainder paragraph
  const firstText = document.createTreeWalker(tail, NodeFilter.SHOW_TEXT).nextNode() as Text | null
  if (firstText) firstText.data = firstText.data.replace(/^\s+/, '')
  return { head, tail }
}

function isSplittable(element: HTMLElement): boolean {
  return /^(P|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|PRE)$/.test(element.tagName)
}

function flattenLists(root: HTMLElement): HTMLElement[] {
  const output: HTMLElement[] = []
  for (const child of Array.from(root.children)) {
    const element = child as HTMLElement
    if (element.tagName === 'UL' || element.tagName === 'OL') {
      const items = Array.from(element.children).filter((node) => node.tagName === 'LI')
      items.forEach((item, index) => {
        const list = element.cloneNode(false) as HTMLOListElement
        if (list.tagName === 'OL') list.start = Number(element.getAttribute('start') ?? 1) + index
        const clone = item.cloneNode(true) as HTMLElement
        list.appendChild(clone)
        output.push(list)
      })
    } else {
      output.push(element.cloneNode(true) as HTMLElement)
    }
  }
  return output
}

function tableRows(table: HTMLTableElement): HTMLTableRowElement[] {
  const rows: HTMLTableRowElement[] = []
  for (const row of Array.from(table.rows)) {
    if (row.parentElement?.tagName === 'THEAD') continue
    rows.push(row)
  }
  return rows
}

function cloneTableWithRows(source: HTMLTableElement, rows: HTMLTableRowElement[]): HTMLTableElement {
  const clone = source.cloneNode(false) as HTMLTableElement
  const thead = source.tHead
  if (thead) clone.appendChild(thead.cloneNode(true))
  const tbody = document.createElement('tbody')
  for (const row of rows) tbody.appendChild(row.cloneNode(true))
  clone.appendChild(tbody)
  return clone
}

/**
 * Convert editor HTML into a sequence of fixed-size page elements with repeated
 * headers, footers and page numbers. Used by PDF export, print preview and print.
 */
export function paginateHtml(options: PaginateOptions): PaginatedDocument {
  const metrics = getPageMetrics(options.settings)
  const reservedHeader = options.header.enabled
  const reservedFooter = options.footer.enabled || options.showPageNumbers
  const headerHeight = reservedHeader ? HEADER_HEIGHT : 0
  const footerHeight = reservedFooter ? FOOTER_HEIGHT : 0
  const contentHeight = Math.max(
    160,
    metrics.pageHeight - metrics.paddingTop - metrics.paddingBottom - headerHeight - footerHeight - 6,
  )

  const host = document.createElement('div')
  host.className = 'kw-paginate-host kw-editor-content'
  host.style.width = `${metrics.contentWidth}px`
  host.style.fontFamily = options.fontFamily
  host.style.fontSize = `${options.fontSize}px`
  host.style.lineHeight = options.lineHeight
  host.style.color = '#161a1f'
  document.body.appendChild(host)

  const measure = (node: HTMLElement): number => {
    const wrapper = document.createElement('div')
    wrapper.className = 'kw-page-block'
    wrapper.style.width = `${metrics.contentWidth}px`
    wrapper.appendChild(node)
    host.appendChild(wrapper)
    const height = wrapper.getBoundingClientRect().height
    wrapper.remove()
    return height
  }

  const template = document.createElement('div')
  template.innerHTML = options.html
  let blocks = flattenLists(template)

  const pages: Array<{ page: HTMLElement; content: HTMLElement }> = []
  let currentPage = 0
  let used = 0

  const newPage = () => {
    const shell = buildPageShell(options, pages.length + 1, 0, reservedHeader, reservedFooter)
    pages.push(shell)
    currentPage = pages.length - 1
    used = 0
  }

  newPage()

  const add = (node: HTMLElement) => {
    const wrapper = document.createElement('div')
    wrapper.className = 'kw-page-block'
    wrapper.appendChild(node)
    pages[currentPage].content.appendChild(wrapper)
  }

  for (const original of blocks) {
    let block = original.cloneNode(true) as HTMLElement

    if (block.matches('[data-page-break], .kw-page-break')) {
      if (used > 0) newPage()
      continue
    }

    // Images: constrain height on an empty page
    if (block.tagName === 'IMG') {
      const height = measure(block)
      if (height > contentHeight) {
        block.style.maxHeight = `${contentHeight}px`
        block.style.width = 'auto'
      }
    }

    let guard = 0
    while (block && guard++ < 200) {
      const height = measure(block)
      const remaining = contentHeight - used

      if (height <= remaining + 0.5) {
        add(block)
        used += height
        break
      }

      // Block fits on an empty page (with overflow for tables/images)
      if (used < 2) {
        if (block.tagName === 'TABLE' && height > contentHeight) {
          const table = block as HTMLTableElement
          const rows = tableRows(table)
          let fit: HTMLTableRowElement[] = []
          let rest = rows
          for (let i = 0; i < rows.length; i++) {
            const candidate = cloneTableWithRows(table, rows.slice(0, i + 1))
            if (measure(candidate) > contentHeight && fit.length) {
              rest = rows.slice(i)
              break
            }
            fit = rows.slice(0, i + 1)
            rest = rows.slice(i + 1)
          }
          add(cloneTableWithRows(table, fit.length ? fit : rows.slice(0, 1)))
          used = contentHeight
          if (rest.length) {
            block = cloneTableWithRows(table, rest)
            newPage()
            continue
          }
          break
        }
        add(block)
        used = height
        newPage()
        break
      }

      if (isSplittable(block)) {
        const split = splitBlockAt(block, remaining, measure)
        if (split?.head) {
          add(split.head)
          block = split.tail
          newPage()
          continue
        }
      }

      if (block.tagName === 'UL' || block.tagName === 'OL') {
        // Single list item taller than the page: place and move on
        add(block)
        newPage()
        break
      }

      newPage()
    }
  }

  // Remove trailing empty page created by a page break at the end
  if (pages.length > 1) {
    const last = pages[pages.length - 1]
    if (!last.content.children.length) {
      last.page.remove()
      pages.pop()
    }
  }

  host.remove()

  const total = pages.length
  const elements = pages.map(({ page }) => {
    page.querySelectorAll<HTMLElement>('.kw-page-header-bar, .kw-page-footer-bar').forEach((bar) => {
      const text = bar.querySelector('span')
      if (text) text.textContent = resolveTokens(text.textContent ?? '', Number(page.dataset.pageNumber), total, options.title)
    })
    return page
  })

  return {
    pages: elements,
    pageCount: total,
    cleanup: () => {
      elements.forEach((page) => page.remove())
    },
  }
}
