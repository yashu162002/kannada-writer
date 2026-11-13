import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: string
  hideClose?: boolean
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = '520px',
  hideClose,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="kw-dialog-overlay" />
        <DialogPrimitive.Content className="kw-dialog-content" style={{ width: `min(92vw, ${width})` }}>
          <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[15px] font-semibold text-ink-900">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-[12px] leading-relaxed text-ink-500">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            {!hideClose ? (
              <DialogPrimitive.Close className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                <X size={16} />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            ) : null}
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-ink-200 bg-ink-50/60 px-5 py-3">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function ConfirmDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
}) {
  const { open, onOpenChange, title, description, confirmLabel, danger, onConfirm } = props
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 rounded-md border border-ink-300 bg-white px-3 text-[12.5px] font-medium text-ink-700 hover:bg-ink-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            className={cn(
              'h-8 rounded-md px-3 text-[12.5px] font-medium text-white',
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700',
            )}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <span className="sr-only">{description}</span>
    </Dialog>
  )
}
