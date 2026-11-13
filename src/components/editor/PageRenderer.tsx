import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, type Editor } from '@tiptap/react'
import type { HeaderFooter, PageSettings } from '@/types/document'
import { CM_TO_PX, getPageMetrics } from '@/lib/page'
import { cn } from '@/lib/utils'

interface PageRendererProps {
  editor: Editor | null
  settings: PageSettings
  zoom: number
  showPageBoundaries: boolean
  showRuler: boolean
  header: HeaderFooter
  footer: HeaderFooter
  showPageNumbers: boolean
  title: string
  fontFamily: string
  fontSize: number
  lineHeight: string
  scrollRef: React.Ref<HTMLDivElement>
  onPageCountChange?: (count: number) => void
  focusMode?: boolean
}

function renderHeaderFooter(
  slot: HeaderFooter,
  page: number,
  total: number,
  title: string,
  showPageNumbers: boolean,
  kind: 'header' | 'footer',
) {
  if (!slot.enabled && !showPageNumbers) return null
  const replaceTokens = (value: string) =>
    value
      .replaceAll('{page}', String(page))
      .replaceAll('{pages}', String(total))
      .replaceAll('{title}', title)
      .replaceAll('{date}', new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date()))

  const hasNumberToken = /\{page\}/.test(slot.content)
  const content = replaceTokens(slot.content)

  return (
    <div className={kind === 'header' ? 'kw-page-header' : 'kw-page-footer'}>
      <span className="flex-1 whitespace-pre-wrap">{content}</span>
      {showPageNumbers && !hasNumberToken ? (
        <span className="kw-page-number">{kind === 'footer' ? `${page}` : ''}</span>
      ) : null}
    </div>
  )
}

/**
 * Renders the editable document as a physical page surface with margins, header,
 * footer, automatic page-division guides and an optional ruler.
 */
export function PageRenderer({
  editor,
  settings,
  zoom,
  showPageBoundaries,
  showRuler,
  header,
  footer,
  showPageNumbers,
  title,
  fontFamily,
  fontSize,
  lineHeight,
  scrollRef,
  onPageCountChange,
}: PageRendererProps) {
  const metrics = useMemo(() => getPageMetrics(settings), [settings])
  const sheetRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(metrics.contentHeight)
  const [pageCount, setPageCount] = useState(1)

  const measure = useCallback(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const editorDom = editor?.view?.dom
    if (!editorDom) return
    const scale = zoom / 100
    const height = editorDom.getBoundingClientRect().height / scale
    const total =
      height +
      metrics.paddingTop +
      metrics.paddingBottom +
      (header.enabled || showPageNumbers ? 28 : 0) +
      (footer.enabled || showPageNumbers ? 28 : 0)
    const nextCount =
      Math.max(1, Math.ceil(total / metrics.pageHeight)) + editorDom.querySelectorAll('.kw-page-break').length
    setContentHeight(Math.max(metrics.contentHeight, height))
    setPageCount((prev) => (prev === nextCount ? prev : nextCount))
  }, [editor, zoom, metrics, header.enabled, footer.enabled, showPageNumbers])

  useEffect(() => {
    measure()
    const editorDom = editor?.view?.dom
    if (!editorDom || typeof ResizeObserver === 'undefined') {
      const timer = window.setTimeout(measure, 400)
      return () => window.clearTimeout(timer)
    }
    const observer = new ResizeObserver(() => measure())
    observer.observe(editorDom)
    const timer = window.setTimeout(measure, 250)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [editor, measure])

  useEffect(() => {
    onPageCountChange?.(pageCount)
  }, [pageCount, onPageCountChange])

  const guides = useMemo(() => {
    if (!showPageBoundaries) return []
    const items: number[] = []
    for (let i = 1; i < pageCount; i++) items.push(i * metrics.pageHeight)
    return items
  }, [pageCount, metrics.pageHeight, showPageBoundaries])

  const cmTicks = useMemo(() => {
    const ticks: Array<{ left: number; major: boolean; label?: string }> = []
    const max = metrics.contentWidth
    for (let i = 0; i * CM_TO_PX <= max + 1; i++) {
      const left = metrics.paddingLeft + i * CM_TO_PX
      const major = i % 2 === 0
      ticks.push({ left, major, label: major ? String(i / 2) : undefined })
    }
    return ticks
  }, [metrics])

  const scaledWidth = metrics.pageWidth * (zoom / 100)
  const scaledHeight =
    Math.max(metrics.pageHeight, contentHeight + metrics.paddingTop + metrics.paddingBottom) * (zoom / 100)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showRuler ? (
        <div className="flex justify-center border-b border-ink-200 bg-[#fbfcfd]">
          <div className="relative" style={{ width: metrics.pageWidth * (zoom / 100), height: 22 }}>
            <div
              className="kw-ruler absolute left-0 top-0 origin-top-left"
              style={{ width: metrics.pageWidth, transform: `scale(${zoom / 100})` }}
            >
              <div className="kw-ruler-margin" style={{ left: 0, width: metrics.paddingLeft }} />
              <div
                className="kw-ruler-margin"
                style={{ left: metrics.paddingLeft + metrics.contentWidth, width: metrics.paddingRight }}
              />
              {cmTicks.map((tick) => (
                <div key={tick.left}>
                  <span
                    className="kw-ruler-tick"
                    style={{ left: tick.left, height: tick.major ? 8 : 4 }}
                  />
                  {tick.label ? (
                    <span className="kw-ruler-label" style={{ left: tick.left }}>
                      {tick.label}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="kw-editor-scroll kw-scroll" ref={scrollRef}>
        <div className={cn('kw-page-stage', 'transition-none')}>
          <div className="kw-page-scale-wrap" style={{ width: scaledWidth, height: scaledHeight }}>
            <div
              ref={sheetRef}
              className="kw-page-sheet"
              data-borders={showPageBoundaries ? 'true' : 'false'}
              data-first="true"
              style={{
                width: metrics.pageWidth,
                minHeight: metrics.pageHeight,
                transform: `scale(${zoom / 100})`,
              }}
            >
              <div
                className="kw-page-body"
                style={{
                  paddingTop: metrics.paddingTop,
                  paddingBottom: metrics.paddingBottom,
                  paddingLeft: metrics.paddingLeft,
                  paddingRight: metrics.paddingRight,
                  minHeight: metrics.pageHeight,
                }}
              >
                {renderHeaderFooter(header, 1, pageCount, title, showPageNumbers, 'header')}
                <div
                  className="kw-editor-content flex-1"
                  style={
                    {
                      '--kw-doc-font': fontFamily,
                      '--kw-doc-font-size': `${fontSize}px`,
                      '--kw-doc-line-height': lineHeight,
                    } as React.CSSProperties
                  }
                >
                  <EditorContent editor={editor} />
                </div>
                {renderHeaderFooter(footer, pageCount, pageCount, title, showPageNumbers, 'footer')}
              </div>

              {showPageBoundaries
                ? guides.map((top, index) => (
                    <div key={top} className="kw-page-guide" style={{ top }}>
                      <span className="kw-page-guide-label">Page {index + 2}</span>
                    </div>
                  ))
                : null}

              {showPageBoundaries
                ? Array.from({ length: pageCount }).map((_, index) => (
                    <span
                      key={`label-${index}`}
                      className="kw-page-gutter"
                      style={{ top: index * metrics.pageHeight + 8, right: Math.max(6, metrics.paddingRight - 30) }}
                    >
                      {index + 1}
                    </span>
                  ))
                : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
