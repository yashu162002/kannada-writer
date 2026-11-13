import { useState } from 'react'
import { AlignVerticalJustifyStart, FileText, Frame, Maximize2, MoveVertical, RectangleHorizontal, RectangleVertical } from 'lucide-react'
import type { PageSettings } from '@/types/document'
import { RibbonButton, RibbonDivider, RibbonGroup, RibbonMenuButton, RibbonSelect } from './RibbonShared'
import { CM_TO_PX } from '@/lib/page'

interface Props {
  settings: PageSettings
  onChange: (settings: PageSettings) => void
}

const PRESETS: Array<{ label: string; margins: PageSettings['margins'] }> = [
  { label: 'Normal — 1" all sides', margins: { top: 96, right: 96, bottom: 96, left: 96 } },
  { label: 'Narrow — 0.5" all sides', margins: { top: 48, right: 48, bottom: 48, left: 48 } },
  {
    label: 'Moderate — 1" top/bottom, 0.75" sides',
    margins: { top: 96, right: 72, bottom: 96, left: 72 },
  },
  {
    label: 'Wide — 1" top/bottom, 2" sides',
    margins: { top: 96, right: 192, bottom: 96, left: 192 },
  },
]

export function LayoutRibbon({ settings, onChange }: Props) {
  const [customOpen, setCustomOpen] = useState(false)
  const marginCm = (px: number) => Math.round((px / CM_TO_PX) * 10) / 10

  const updateMargins = (key: keyof PageSettings['margins'], cmValue: string) => {
    const cm = Number.parseFloat(cmValue)
    if (!Number.isFinite(cm)) return
    const px = Math.round(Math.min(15, Math.max(0.5, cm)) * CM_TO_PX)
    onChange({ ...settings, margins: { ...settings.margins, [key]: px } })
  }

  return (
    <div className="kw-ribbon-scroller">
      <RibbonGroup label="Page setup">
        <RibbonSelect
          value={settings.size}
          onChange={(value) => onChange({ ...settings, size: value as PageSettings['size'] })}
          title="Page size"
          className="w-[92px]"
          options={[
            { value: 'A4', label: 'A4' },
            { value: 'A5', label: 'A5' },
            { value: 'Letter', label: 'Letter' },
            { value: 'Legal', label: 'Legal' },
          ]}
        />
        <RibbonDivider />
        <RibbonButton
          icon={<RectangleVertical size={16} />}
          label="Portrait"
          active={settings.orientation === 'portrait'}
          onClick={() => onChange({ ...settings, orientation: 'portrait' })}
          title="Portrait orientation"
        />
        <RibbonButton
          icon={<RectangleHorizontal size={16} />}
          label="Landscape"
          active={settings.orientation === 'landscape'}
          onClick={() => onChange({ ...settings, orientation: 'landscape' })}
          title="Landscape orientation"
        />
      </RibbonGroup>

      <RibbonGroup label="Margins">
        <RibbonMenuButton icon={<Frame size={16} />} label="Margins" title="Page margins">
          <div className="w-[250px]">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="kw-menu-item"
                onClick={() => onChange({ ...settings, margins: preset.margins })}
              >
                {preset.label}
              </button>
            ))}
            <div className="my-1 h-px bg-ink-200" />
            <button
              type="button"
              className="kw-menu-item font-medium text-brand-700"
              onClick={() => setCustomOpen((value) => !value)}
            >
              Custom margins…
            </button>
            {customOpen ? (
              <div className="grid grid-cols-2 gap-2 px-2 pb-2 pt-1">
                {(
                  [
                    ['top', 'Top'],
                    ['bottom', 'Bottom'],
                    ['left', 'Left'],
                    ['right', 'Right'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-[10px] text-ink-500">
                    {label} (cm)
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="15"
                      value={marginCm(settings.margins[key])}
                      onChange={(event) => updateMargins(key, event.target.value)}
                      className="mt-0.5 h-7 w-full rounded border border-ink-300 px-1.5 text-[11.5px] outline-none focus:border-brand-500"
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </RibbonMenuButton>
      </RibbonGroup>

      <RibbonGroup label="Spacing">
        <RibbonMenuButton icon={<MoveVertical size={16} />} label="Page gap" title="Gap between pages">
          <div className="w-[170px]">
            {[16, 24, 28, 40, 56].map((value) => (
              <button
                key={value}
                type="button"
                className="kw-menu-item"
                onClick={() => onChange({ ...settings, pageSpacing: value })}
              >
                {value === 28 ? 'Default' : `${value}px`}
              </button>
            ))}
          </div>
        </RibbonMenuButton>
        <RibbonDivider />
        <RibbonButton
          icon={<Frame size={16} />}
          label="Page borders"
          active={settings.showPageBorders}
          onClick={() => onChange({ ...settings, showPageBorders: !settings.showPageBorders })}
          title="Show page borders"
        />
      </RibbonGroup>

      <RibbonGroup label="Layout summary">
        <div className="flex flex-col justify-center px-1 text-[10.5px] leading-tight text-ink-500">
          <span className="font-medium text-ink-700">
            {settings.size} · {settings.orientation}
          </span>
          <span>
            Margins {marginCm(settings.margins.top)} / {marginCm(settings.margins.right)} /{' '}
            {marginCm(settings.margins.bottom)} / {marginCm(settings.margins.left)} cm
          </span>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Paper">
        <div className="flex items-center gap-1.5 text-ink-400">
          <FileText size={18} />
          <Maximize2 size={16} />
          <AlignVerticalJustifyStart size={16} />
        </div>
      </RibbonGroup>
    </div>
  )
}
