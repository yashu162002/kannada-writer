import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search, Type } from 'lucide-react'
import { Popover } from '@/components/common/Dropdown'
import { KANNADA_FONTS, getFontStack } from '@/lib/fonts'
import { cn } from '@/lib/utils'

export function FontFamilyButton({
  value,
  onChange,
}: {
  value: string
  onChange: (font: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return KANNADA_FONTS
    return KANNADA_FONTS.filter((font) => font.label.toLowerCase().includes(q))
  }, [query])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof KANNADA_FONTS>()
    for (const font of filtered) {
      const list = map.get(font.group) ?? []
      list.push(font)
      map.set(font.group, list)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      className="w-[290px] p-0"
      trigger={
        <button
          type="button"
          className="ribbon-select flex w-[172px] items-center justify-between gap-1 text-left"
          title="Font family"
        >
          <span className="truncate" style={{ fontFamily: getFontStack(value) }}>
            {value}
          </span>
          <ChevronDown size={12} className="shrink-0 text-ink-400" />
        </button>
      }
    >
      <div className="flex items-center gap-1.5 border-b border-ink-200 px-2 py-1.5">
        <Search size={13} className="text-ink-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search fonts"
          className="h-6 w-full border-0 bg-transparent text-[12px] outline-none placeholder:text-ink-400"
          autoFocus
        />
      </div>
      <div className="max-h-[320px] overflow-y-auto py-1">
        {grouped.map(([group, fonts]) => (
          <div key={group}>
            <p className="px-2.5 pb-1 pt-2 text-[9.5px] font-semibold uppercase tracking-wide text-ink-400">
              {group}
            </p>
            {fonts.map((font) => (
              <button
                key={font.name}
                type="button"
                onClick={() => {
                  onChange(font.name)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-ink-50"
              >
                <span
                  className="w-4 shrink-0 text-brand-700"
                  style={{ visibility: value === font.name ? 'visible' : 'hidden' }}
                >
                  <Check size={12} />
                </span>
                <span className="flex-1">
                  <span className="block text-[12px] text-ink-800">{font.label}</span>
                  <span
                    className="block text-[13px] leading-snug text-ink-500"
                    style={{ fontFamily: font.stack, fontWeight: font.weight }}
                  >
                    ಕನ್ನಡ ಬರವಣಿಗೆ
                  </span>
                </span>
                {font.note ? (
                  <span className="max-w-[72px] text-right text-[8.5px] leading-tight text-ink-400">
                    {font.note}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ))}
        {!filtered.length ? (
          <p className="flex items-center gap-2 px-3 py-4 text-[11.5px] text-ink-500">
            <Type size={13} /> No matching font
          </p>
        ) : null}
      </div>
      <div className="border-t border-ink-200 bg-ink-50/60 px-2.5 py-1.5 text-[9.5px] leading-relaxed text-ink-500">
        Bundled fonts render offline. Optional fonts fall back to Noto Sans Kannada if not installed.
      </div>
    </Popover>
  )
}

export function FontSizeSelect({
  value,
  onChange,
  sizes,
}: {
  value: number
  onChange: (size: number) => void
  sizes: readonly number[]
}) {
  return (
    <select
      className="ribbon-select w-[64px] text-center"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      title="Font size (pt)"
      aria-label="Font size"
    >
      {sizes.map((size) => (
        <option key={size} value={size}>
          {size}
        </option>
      ))}
    </select>
  )
}

export function ColorSwatches({
  onPick,
  includeNone,
  onNone,
}: {
  onPick: (color: string) => void
  includeNone?: boolean
  onNone?: () => void
}) {
  const colors = [
    '#000000', '#3a434e', '#6b7581', '#ffffff',
    '#b42318', '#d92d20', '#f04438', '#f79009',
    '#dc6803', '#eaaa08', '#66c61c', '#12b76a',
    '#039855', '#0e9384', '#0ba5ec', '#1570ef',
    '#175cd3', '#3538cd', '#6938ef', '#9e77ed',
    '#ba24d5', '#dd2590', '#f63d68', '#8b4513',
  ]
  return (
    <div className="w-[190px]">
      <div className="grid grid-cols-8 gap-1">
        {includeNone ? (
          <button
            type="button"
            title="No color"
            onClick={onNone}
            className="relative col-span-1 h-5 w-5 rounded border border-ink-300 bg-white text-[10px] text-red-500"
          >
            /
          </button>
        ) : null}
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => onPick(color)}
            className={cn(
              'h-5 w-5 rounded border border-black/10 transition-transform hover:scale-110',
              color === '#ffffff' && 'border-ink-300',
            )}
            style={{ background: color }}
          />
        ))}
      </div>
      <label className="mt-2 flex items-center gap-2 text-[10.5px] text-ink-500">
        Custom
        <input
          type="color"
          className="h-6 w-9 cursor-pointer rounded border border-ink-300 bg-white p-0"
          onChange={(event) => onPick(event.target.value)}
        />
      </label>
    </div>
  )
}
