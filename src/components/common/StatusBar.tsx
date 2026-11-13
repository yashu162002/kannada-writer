import { Circle, FileText, Languages, Loader2, Minus, Plus, Save } from 'lucide-react'
import type { SaveState } from '@/types/document'
import { transliterationService } from '@/services/transliteration/TransliterationService'
import { cn } from '@/lib/utils'

interface Props {
  words: number
  characters: number
  pages: number
  pageNumber?: number
  zoom: number
  onZoomChange: (zoom: number) => void
  saveState: SaveState
  lastSavedLabel: string
  kanndaMode: string
}

export function StatusBar({
  words,
  characters,
  pages,
  zoom,
  onZoomChange,
  saveState,
  lastSavedLabel,
  kanndaMode,
}: Props) {
  const status = transliterationService.providerStatus
  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'dirty'
        ? 'Unsaved changes'
        : saveState === 'error'
          ? 'Save failed'
          : lastSavedLabel

  return (
    <div className="kw-statusbar flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <FileText size={12} />
          {pages} {pages === 1 ? 'page' : 'pages'}
        </span>
        <span>{words.toLocaleString()} words</span>
        <span>{characters.toLocaleString()} characters</span>
        <span className="inline-flex items-center gap-1" title={status.description}>
          <Languages size={12} className="text-brand-600" />
          {kanndaMode}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span
          className={cn(
            'inline-flex items-center gap-1',
            saveState === 'error' && 'text-red-600',
            saveState === 'saved' && 'text-brand-700',
          )}
        >
          {saveState === 'saving' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : saveState === 'dirty' ? (
            <Circle size={8} className="fill-amber-500 text-amber-500" />
          ) : (
            <Save size={12} />
          )}
          {saveLabel}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-0.5 hover:bg-ink-200"
            onClick={() => onZoomChange(Math.max(50, zoom - 10))}
            aria-label="Zoom out"
          >
            <Minus size={12} />
          </button>
          <button
            type="button"
            className="min-w-[38px] rounded px-1 py-0.5 tabular-nums hover:bg-ink-200"
            onClick={() => onZoomChange(100)}
            title="Reset zoom to 100%"
          >
            {zoom}%
          </button>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-ink-200"
            onClick={() => onZoomChange(Math.min(200, zoom + 10))}
            aria-label="Zoom in"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
