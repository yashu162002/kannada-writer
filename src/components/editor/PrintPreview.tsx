import { useEffect, useRef, useState } from 'react'
import { Download, Printer, X } from 'lucide-react'
import type { ExportContext } from '@/services/export/types'
import { buildPrintPages } from '@/services/export/PrintService'
import { getPageMetrics } from '@/lib/page'
import { Button } from '@/components/common/Button'

export function PrintPreview({
  open,
  onClose,
  context,
  onPrint,
  onDownloadPdf,
  pdfBusy,
}: {
  open: boolean
  onClose: () => void
  context: ExportContext | null
  onPrint: () => void
  onDownloadPdf: () => void
  pdfBusy: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(0.72)

  useEffect(() => {
    if (!open || !context) return
    let disposed = false
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''

    const render = async () => {
      await document.fonts?.ready?.catch?.(() => undefined)
      if (disposed) return
      const pages = buildPrintPages(context)
      const metrics = getPageMetrics(context.settings)
      const fit = Math.min(1, (container.clientWidth - 48) / metrics.pageWidth)
      setScale(fit > 0 ? fit : 0.7)
      setPageCount(pages.length)
      container.innerHTML = ''
      pages.forEach((page) => {
        const wrapper = document.createElement('div')
        wrapper.style.width = `${metrics.pageWidth * fit}px`
        wrapper.style.height = `${metrics.pageHeight * fit}px`
        wrapper.style.flex = '0 0 auto'
        wrapper.style.position = 'relative'
        page.style.transformOrigin = 'top left'
        page.style.transform = `scale(${fit})`
        page.style.position = 'absolute'
        page.style.left = '0'
        page.style.top = '0'
        wrapper.appendChild(page)
        container.appendChild(wrapper)
      })
    }
    void render()

    const onResize = () => {
      const metrics = getPageMetrics(context.settings)
      const fit = Math.min(1, (container.clientWidth - 48) / metrics.pageWidth)
      setScale(fit > 0 ? fit : 0.7)
      container.querySelectorAll<HTMLElement>('[data-kw-preview-page]').forEach((node) => {
        node.style.transform = `scale(${fit})`
      })
    }
    window.addEventListener('resize', onResize)

    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      if (container) container.innerHTML = ''
    }
  }, [open, context])

  if (!open || !context) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-900/55 p-2 sm:p-5">
      <div className="flex h-full w-full max-w-[1240px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold text-ink-900">Print preview</h2>
            <p className="text-[10.5px] text-ink-500">
              {pageCount} {pageCount === 1 ? 'page' : 'pages'} · {context.settings.size} ·{' '}
              {context.settings.orientation} · {Math.round(scale * 100)}% preview
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onDownloadPdf} disabled={pdfBusy}>
              <Download size={14} />
              {pdfBusy ? 'Building PDF…' : 'Download PDF'}
            </Button>
            <Button size="sm" onClick={onPrint}>
              <Printer size={14} />
              Print
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100"
              aria-label="Close preview"
            >
              <X size={17} />
            </button>
          </div>
        </div>
        <div ref={containerRef} className="kw-preview-scroll kw-scroll" />
        <div className="border-t border-ink-200 bg-ink-50 px-4 py-2 text-[10.5px] text-ink-500">
          Tip: “Download PDF” rasterises pages at 2× for perfect Kannada shaping. Use Print → Save as PDF if you need
          selectable text.
        </div>
      </div>
    </div>
  )
}
