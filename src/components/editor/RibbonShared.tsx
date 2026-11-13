import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover } from '@/components/common/Dropdown'

export function RibbonGroup({
  label,
  children,
  className,
}: {
  label?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('kw-ribbon-group', className)}>
      <div className="flex flex-1 items-center gap-0.5">{children}</div>
      {label ? <div className="kw-ribbon-group-label">{label}</div> : null}
    </div>
  )
}

export function RibbonButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  title,
  showLabel = true,
  className,
}: {
  icon: React.ReactNode
  label?: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  showLabel?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      className={cn('ribbon-button', !showLabel && 'ribbon-button-icon', className)}
      onClick={onClick}
      disabled={disabled}
      data-active={active ? 'true' : 'false'}
      title={title ?? label}
      aria-label={title ?? label}
    >
      <span className="shrink-0 text-ink-600">{icon}</span>
      {showLabel && label ? <span className="ribbon-label">{label}</span> : null}
    </button>
  )
}

export function RibbonMenuButton({
  icon,
  label,
  children,
  align = 'start',
  title,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  title?: string
}) {
  return (
    <Popover
      align={align}
      className="p-2"
      trigger={
        <button type="button" className="ribbon-button" title={title ?? label}>
          <span className="shrink-0 text-ink-600">{icon}</span>
          <span className="ribbon-label">{label}</span>
          <ChevronDown size={10} className="text-ink-400" />
        </button>
      }
    >
      {children}
    </Popover>
  )
}

export function RibbonSelect({
  value,
  onChange,
  options,
  title,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  title?: string
  className?: string
}) {
  return (
    <select
      className={cn('ribbon-select', className)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      title={title}
      aria-label={title}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function RibbonDivider() {
  return <span className="mx-0.5 h-6 w-px shrink-0 bg-ink-200" aria-hidden />
}

export function TableSizePicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = React.useState({ rows: 0, cols: 0 })
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium text-ink-600">
        {hover.rows > 0 ? `${hover.rows} × ${hover.cols} table` : 'Choose table size'}
      </p>
      <div className="grid grid-cols-8 gap-1" onMouseLeave={() => setHover({ rows: 0, cols: 0 })}>
        {Array.from({ length: 64 }).map((_, index) => {
          const rows = Math.floor(index / 8) + 1
          const cols = (index % 8) + 1
          const active = rows <= hover.rows && cols <= hover.cols
          return (
            <button
              key={index}
              type="button"
              aria-label={`${rows} by ${cols} table`}
              onMouseEnter={() => setHover({ rows, cols })}
              onClick={() => onPick(rows, cols)}
              className={cn(
                'h-5 w-5 rounded-[3px] border transition-colors',
                active ? 'border-brand-500 bg-brand-100' : 'border-ink-300 bg-ink-50 hover:bg-brand-50',
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
