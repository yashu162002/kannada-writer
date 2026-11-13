import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Check, Loader2, Sparkles, X } from 'lucide-react'
import type { TypingPopupState } from '@/hooks/useKannadaTyping'

interface Props {
  editor: Editor | null
  popup: TypingPopupState
  onSelect: (index: number) => void
  onClose: () => void
  autoConvert: boolean
}

/**
 * Floating suggestion list anchored to the caret. Uses fixed positioning so it
 * is unaffected by page zoom transforms.
 */
export function SuggestionPopup({ editor, popup, onSelect, onClose, autoConvert }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ left: number; top: number; above: boolean }>({
    left: 0,
    top: 0,
    above: false,
  })

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return
    const view = editor.view
    let rect: { left: number; top: number; bottom: number } | null = null
    try {
      rect = view.coordsAtPos(Math.min(popup.to, view.state.doc.content.size))
    } catch {
      rect = null
    }
    if (!rect) return
    const width = 300
    const estimatedHeight = Math.min(56 + popup.suggestions.length * 38, 320)
    const above = rect.bottom + estimatedHeight + 24 > window.innerHeight
    setCoords({
      left: Math.max(10, Math.min(rect.left, window.innerWidth - width - 12)),
      top: above ? Math.max(10, rect.top - estimatedHeight - 8) : rect.bottom + 8,
      above,
    })
  }, [editor, popup])

  useEffect(() => {
    const active = ref.current?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [popup.activeIndex])

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    // defer so the click that opened it does not immediately close it
    const timer = window.setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="kw-suggestion fixed z-[80] w-[300px] max-w-[calc(100vw-20px)]"
      style={{ left: coords.left, top: coords.top }}
      role="listbox"
      aria-label="Kannada transliteration suggestions"
    >
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 bg-ink-50/60 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Sparkles size={12} className="shrink-0 text-brand-600" />
          <span className="truncate font-mono text-[11px] text-ink-500">{popup.word}</span>
          {popup.loading ? <Loader2 size={11} className="animate-spin text-ink-400" /> : null}
        </div>
        <div className="flex items-center gap-1">
          <span className="max-w-[110px] truncate text-[9.5px] uppercase tracking-wide text-ink-400">
            {popup.provider}
          </span>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClose}
            className="rounded p-0.5 text-ink-400 hover:bg-ink-200 hover:text-ink-700"
            aria-label="Close suggestions"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      <div className="max-h-[264px] overflow-y-auto py-1">
        {popup.suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.text}-${index}`}
            type="button"
            role="option"
            aria-selected={index === popup.activeIndex}
            data-active={index === popup.activeIndex}
            className="kw-suggestion-item"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(index)}
          >
            <span className="truncate">{suggestion.text}</span>
            <span className="flex items-center gap-1.5">
              {suggestion.source === 'personal' ? (
                <span className="rounded bg-brand-50 px-1.5 py-0.5 font-sans text-[9px] font-medium text-brand-700">
                  mine
                </span>
              ) : suggestion.source === 'online' ? (
                <span className="rounded bg-sky-50 px-1.5 py-0.5 font-sans text-[9px] font-medium text-sky-700">
                  online
                </span>
              ) : null}
              {index === popup.activeIndex ? (
                <Check size={13} className="shrink-0 text-brand-600" />
              ) : (
                <span className="font-sans text-[9px] tabular-nums text-ink-300">{index + 1}</span>
              )}
            </span>
          </button>
        ))}
        {!popup.suggestions.length ? (
          <p className="px-3 py-3 text-[11.5px] text-ink-500">No suggestions yet — keep typing.</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-ink-100 px-2.5 py-1.5 text-[9.5px] text-ink-400">
        <span>↑ ↓ choose · {autoConvert ? 'Space accept' : 'Enter/Tab accept'} · Esc close</span>
        <span className="font-kannada text-brand-700">ಕನ್ನಡ</span>
      </div>
    </div>
  )
}
