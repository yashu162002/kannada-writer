import * as React from 'react'
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

export function Dropdown({
  trigger,
  children,
  align = 'start',
  open,
  onOpenChange,
  sideOffset = 6,
}: {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  sideOffset?: number
}) {
  return (
    <DropdownPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          align={align}
          sideOffset={sideOffset}
          className="kw-menu z-[70] max-h-[min(70vh,560px)] overflow-y-auto"
        >
          {children}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  )
}

export function DropdownItem({
  children,
  onSelect,
  danger,
  disabled,
  shortcut,
}: {
  children: React.ReactNode
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
  shortcut?: string
}) {
  return (
    <DropdownPrimitive.Item
      disabled={disabled}
      data-danger={danger ? 'true' : 'false'}
      onSelect={() => {
        onSelect?.()
      }}
      className="kw-menu-item outline-none data-[disabled]:opacity-40 data-[disabled]:pointer-events-none"
    >
      <span className="flex-1">{children}</span>
      {shortcut ? <span className="text-[10.5px] text-ink-400">{shortcut}</span> : null}
    </DropdownPrimitive.Item>
  )
}

export function DropdownSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-ink-200" />
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownPrimitive.Label className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
      {children}
    </DropdownPrimitive.Label>
  )
}

export function Popover({
  trigger,
  children,
  align = 'start',
  className,
  open,
  onOpenChange,
}: {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          className={cn('kw-menu z-[70] p-3', className)}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { DropdownPrimitive, PopoverPrimitive }
