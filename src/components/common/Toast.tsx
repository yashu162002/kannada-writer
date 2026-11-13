import * as React from 'react'

export interface ToastItem {
  id: number
  title: string
  description?: string
  tone?: 'default' | 'success' | 'error'
}

let counter = 0

export function toast(title: string, description?: string, tone: ToastItem['tone'] = 'default'): void {
  window.dispatchEvent(
    new CustomEvent<ToastItem>('kannada-writer:toast', {
      detail: { id: ++counter, title, description, tone },
    }),
  )
}

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([])

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ToastItem>).detail
      setItems((prev) => [...prev.slice(-2), detail])
      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== detail.id))
      }, detail.tone === 'error' ? 6000 : 3200)
    }
    window.addEventListener('kannada-writer:toast', handler)
    return () => window.removeEventListener('kannada-writer:toast', handler)
  }, [])

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={
            'pointer-events-auto rounded-lg border bg-white px-3.5 py-2.5 shadow-lg ' +
            (item.tone === 'error'
              ? 'border-red-200'
              : item.tone === 'success'
                ? 'border-brand-200'
                : 'border-ink-200')
          }
        >
          <p className="text-[12.5px] font-semibold text-ink-900">{item.title}</p>
          {item.description ? (
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">{item.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}
