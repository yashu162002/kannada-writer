import {
  Maximize,
  Minus,
  MonitorPlay,
  Plus,
  Printer,
  Ruler,
  Scan,
  StretchHorizontal,
  Target,
} from 'lucide-react'
import type { ViewSettings } from '@/types/document'
import { RibbonButton, RibbonDivider, RibbonGroup, RibbonSelect } from './RibbonShared'
import { clamp } from '@/lib/utils'

interface Props {
  view: ViewSettings
  onChange: (view: ViewSettings) => void
  onPrintPreview: () => void
}

export function ViewRibbon({ view, onChange, onPrintPreview }: Props) {
  const setZoom = (zoom: number) => onChange({ ...view, zoom: clamp(Math.round(zoom), 50, 200) })

  const enterFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => undefined)
    }
  }

  return (
    <div className="kw-ribbon-scroller">
      <RibbonGroup label="Zoom">
        <RibbonButton
          icon={<Minus size={15} />}
          label="Zoom out"
          onClick={() => setZoom(view.zoom - 10)}
          showLabel={false}
          title="Zoom out"
        />
        <RibbonSelect
          value={String(view.zoom)}
          onChange={(value) => setZoom(Number(value))}
          options={[50, 75, 90, 100, 110, 125, 150, 175, 200].map((value) => ({
            value: String(value),
            label: `${value}%`,
          }))}
          title="Zoom level"
          className="w-[72px] text-center"
        />
        <RibbonButton
          icon={<Plus size={15} />}
          label="Zoom in"
          onClick={() => setZoom(view.zoom + 10)}
          showLabel={false}
          title="Zoom in"
        />
        <RibbonButton
          icon={<Scan size={15} />}
          label="100%"
          onClick={() => setZoom(100)}
          title="Actual size"
        />
      </RibbonGroup>

      <RibbonGroup label="Show">
        <RibbonButton
          icon={<StretchHorizontal size={16} />}
          label="Page boundaries"
          active={view.showPageBoundaries}
          onClick={() => onChange({ ...view, showPageBoundaries: !view.showPageBoundaries })}
          title="Show or hide page boundaries"
        />
        <RibbonButton
          icon={<Ruler size={16} />}
          label="Ruler"
          active={view.showRuler}
          onClick={() => onChange({ ...view, showRuler: !view.showRuler })}
          title="Show horizontal ruler"
        />
        <RibbonButton
          icon={<MonitorPlay size={16} />}
          label="Page view"
          active={view.pageView}
          onClick={() => onChange({ ...view, pageView: !view.pageView })}
          title="Page view or continuous view"
        />
      </RibbonGroup>

      <RibbonGroup label="Focus">
        <RibbonButton
          icon={<Target size={16} />}
          label="Focus mode"
          active={view.focusMode}
          onClick={() => onChange({ ...view, focusMode: !view.focusMode })}
          title="Focus mode (hide chrome)"
        />
        <RibbonDivider />
        <RibbonButton
          icon={<Maximize size={16} />}
          label="Full screen"
          onClick={enterFullscreen}
          title="Toggle full screen"
        />
      </RibbonGroup>

      <RibbonGroup label="Output">
        <RibbonButton icon={<Printer size={16} />} label="Print preview" onClick={onPrintPreview} title="Print preview" />
      </RibbonGroup>
    </div>
  )
}
