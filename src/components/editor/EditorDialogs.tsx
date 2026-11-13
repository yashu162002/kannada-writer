import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Dialog } from '@/components/common/Dialog'
import { Button } from '@/components/common/Button'
import { toast } from '@/components/common/Toast'
import type { HeaderFooter } from '@/types/document'

/* ── Image insertion ─────────────────────────────────────────────────────── */

export function ImageDialog({
  open,
  onOpenChange,
  editor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editor: Editor | null
}) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  const [dataUrl, setDataUrl] = useState('')
  const [url, setUrl] = useState('')
  const [alt, setAlt] = useState('')
  const [width, setWidth] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setDataUrl('')
      setUrl('')
      setAlt('')
      setWidth('')
    }
  }, [open])

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Not an image', 'Choose a PNG, JPEG, WebP, GIF or SVG file.', 'error')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast('Image too large', 'Please choose an image smaller than 8 MB.', 'error')
      return
    }
    const encoded = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not read the image file'))
      reader.readAsDataURL(file)
    }).catch((error: unknown) => {
      toast('Could not read image', error instanceof Error ? error.message : undefined, 'error')
      return ''
    })
    if (encoded) setDataUrl(encoded)
  }

  const src = mode === 'upload' ? dataUrl : url.trim()
  const insert = () => {
    if (!editor) return
    if (!src) {
      toast('Choose an image', 'Upload a file or paste an image URL.', 'error')
      return
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'image',
        attrs: {
          src,
          alt: alt || null,
          width: width ? Number(width) : null,
        },
      })
      .run()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Insert image"
      description="Images are embedded in the document so they export cleanly and work offline."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={insert}>
            Insert image
          </Button>
        </>
      }
    >
      <div className="mb-3 flex rounded-lg border border-ink-200 bg-ink-50 p-0.5 text-[12px]">
        {(['upload', 'url'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={
              'flex-1 rounded-md px-3 py-1.5 font-medium ' +
              (mode === option ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800')
            }
          >
            {option === 'upload' ? 'Upload file' : 'From URL'}
          </button>
        ))}
      </div>

      {mode === 'upload' ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink-300 bg-ink-50/60 text-[12px] text-ink-500 hover:border-brand-400 hover:bg-brand-50/40"
        >
          {dataUrl ? (
            <img src={dataUrl} alt="" className="max-h-24 max-w-[80%] rounded object-contain" />
          ) : (
            <>
              <span className="font-medium text-ink-700">Choose an image</span>
              <span>PNG, JPEG, WebP, GIF or SVG · up to 8 MB</span>
            </>
          )}
        </button>
      ) : (
        <input
          className="kw-input"
          placeholder="https://example.com/image.jpg"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="kw-label" htmlFor="img-alt">
            Alternative text
          </label>
          <input id="img-alt" className="kw-input" value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="Description" />
        </div>
        <div>
          <label className="kw-label" htmlFor="img-width">
            Width (px)
          </label>
          <input
            id="img-width"
            type="number"
            min={40}
            className="kw-input"
            value={width}
            onChange={(event) => setWidth(event.target.value)}
            placeholder="Auto"
          />
        </div>
      </div>
      {mode === 'url' ? (
        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-500">
          External URLs are embedded by reference. Upload a file for a fully offline document.
        </p>
      ) : null}
    </Dialog>
  )
}

/* ── Link insertion ──────────────────────────────────────────────────────── */

export function LinkDialog({
  open,
  onOpenChange,
  editor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editor: Editor | null
}) {
  const [label, setLabel] = useState('')
  const [href, setHref] = useState('')

  useEffect(() => {
    if (!open || !editor) return
    const { from, to } = editor.state.selection
    setLabel(from !== to ? editor.state.doc.textBetween(from, to, ' ') : '')
    const existing = editor.getAttributes('link').href as string | undefined
    setHref(existing ?? '')
  }, [open, editor])

  const insert = () => {
    if (!editor || !href.trim()) {
      toast('Link URL required', 'Enter the destination address.', 'error')
      return
    }
    let normalized = href.trim()
    if (!/^[a-z]+:/i.test(normalized) && !normalized.startsWith('/') && !normalized.startsWith('#')) {
      normalized = `https://${normalized}`
    }
    const { empty } = editor.state.selection
    if (empty) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: label || normalized,
          marks: [{ type: 'link', attrs: { href: normalized } }],
        })
        .run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run()
    }
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Insert hyperlink"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={insert}>
            Apply link
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="kw-label" htmlFor="link-label">
            Display text
          </label>
          <input
            id="link-label"
            className="kw-input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Optional when text is selected"
          />
        </div>
        <div>
          <label className="kw-label" htmlFor="link-href">
            Address
          </label>
          <input
            id="link-href"
            className="kw-input"
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="https://example.com"
          />
        </div>
        {editor?.isActive('link') ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              editor.chain().focus().unsetLink().run()
              onOpenChange(false)
            }}
          >
            Remove link
          </Button>
        ) : null}
      </div>
    </Dialog>
  )
}

/* ── Header / footer editor ──────────────────────────────────────────────── */

export function HeaderFooterDialog({
  open,
  onOpenChange,
  kind,
  value,
  onChange,
  showPageNumbers,
  onShowPageNumbersChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: 'header' | 'footer'
  value: HeaderFooter
  onChange: (value: HeaderFooter) => void
  showPageNumbers: boolean
  onShowPageNumbersChange: (value: boolean) => void
}) {
  const [content, setContent] = useState(value.content)
  const [enabled, setEnabled] = useState(value.enabled)
  const [numbers, setNumbers] = useState(showPageNumbers)

  useEffect(() => {
    if (open) {
      setContent(value.content)
      setEnabled(value.enabled)
      setNumbers(showPageNumbers)
    }
  }, [open, value, showPageNumbers])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={kind === 'header' ? 'Edit header' : 'Edit footer'}
      description="Repeats on every printed page. Use {page}, {pages}, {title} and {date} tokens."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onChange({ enabled, content })
              onShowPageNumbersChange(numbers)
              onOpenChange(false)
            }}
          >
            Apply
          </Button>
        </>
      }
    >
      <label className="mb-3 flex items-center gap-2 text-[12.5px] text-ink-800">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Show {kind} on every page
      </label>
      <label className="kw-label" htmlFor="hf-content">
        {kind === 'header' ? 'Header text' : 'Footer text'}
      </label>
      <textarea
        id="hf-content"
        className="min-h-[96px] w-full rounded-lg border border-ink-300 p-2.5 text-[13px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={kind === 'header' ? 'My document — {date}' : 'Kannada Writer · Page {page} of {pages}'}
      />
      <label className="mt-3 flex items-center gap-2 text-[12.5px] text-ink-800">
        <input type="checkbox" checked={numbers} onChange={(event) => setNumbers(event.target.checked)} />
        Show page numbers
      </label>
      <p className="mt-2 text-[10.5px] leading-relaxed text-ink-500">
        Tip: if your footer already contains <code className="rounded bg-ink-100 px-1">{'{page}'}</code>, the page
        number is not repeated automatically.
      </p>
    </Dialog>
  )
}

/* ── Document properties ─────────────────────────────────────────────────── */

export function PropertiesDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  subject,
  author,
  onChangeMeta,
  createdAt,
  updatedAt,
  words,
  characters,
  pages,
  font,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onTitleChange: (title: string) => void
  subject: string
  author: string
  onChangeMeta: (meta: { subject: string; author: string }) => void
  createdAt: number
  updatedAt: number
  words: number
  characters: number
  pages: number
  font: string
}) {
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftSubject, setDraftSubject] = useState(subject)
  const [draftAuthor, setDraftAuthor] = useState(author)

  useEffect(() => {
    if (open) {
      setDraftTitle(title)
      setDraftSubject(subject)
      setDraftAuthor(author)
    }
  }, [open, title, subject, author])

  const rows = useMemo(
    () => [
      ['Created', new Date(createdAt).toLocaleString()],
      ['Last modified', new Date(updatedAt).toLocaleString()],
      ['Words', words.toLocaleString()],
      ['Characters', characters.toLocaleString()],
      ['Pages (estimated)', String(pages)],
      ['Default font', font],
      ['Storage', 'This browser (IndexedDB)'],
    ],
    [createdAt, updatedAt, words, characters, pages, font],
  )

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Document properties"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onTitleChange(draftTitle)
              onChangeMeta({ subject: draftSubject, author: draftAuthor })
              onOpenChange(false)
            }}
          >
            Save properties
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="kw-label" htmlFor="prop-title">
            Title
          </label>
          <input id="prop-title" className="kw-input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
        </div>
        <div>
          <label className="kw-label" htmlFor="prop-subject">
            Subject
          </label>
          <input id="prop-subject" className="kw-input" value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} />
        </div>
        <div>
          <label className="kw-label" htmlFor="prop-author">
            Author
          </label>
          <input id="prop-author" className="kw-input" value={draftAuthor} onChange={(event) => setDraftAuthor(event.target.value)} />
        </div>
      </div>
      <dl className="mt-4 divide-y divide-ink-100 rounded-lg border border-ink-200">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-[11.5px]">
            <dt className="text-ink-500">{label}</dt>
            <dd className="text-right font-medium text-ink-800">{value}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
