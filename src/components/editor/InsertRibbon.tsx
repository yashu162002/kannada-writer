import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  CalendarDays,
  Columns3,
  Image as ImageIcon,
  Link2,
  Minus,
  PanelBottom,
  PanelTop,
  Rows3,
  Table2,
  Trash2,
  Hash,
  Plus,
} from 'lucide-react'
import type { HeaderFooter } from '@/types/document'
import { RibbonGroup, RibbonButton, RibbonDivider, RibbonMenuButton, TableSizePicker } from './RibbonShared'
import { HeaderFooterDialog, ImageDialog, LinkDialog } from './EditorDialogs'
import { Popover } from '@/components/common/Dropdown'
import { toast } from '@/components/common/Toast'

interface Props {
  editor: Editor | null
  header: HeaderFooter
  footer: HeaderFooter
  showPageNumbers: boolean
  onHeaderChange: (value: HeaderFooter) => void
  onFooterChange: (value: HeaderFooter) => void
  onShowPageNumbersChange: (value: boolean) => void
}

function kannadaDate(): string {
  try {
    return new Intl.DateTimeFormat('kn-IN', { dateStyle: 'long' }).format(new Date())
  } catch {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date())
  }
}

export function InsertRibbon({
  editor,
  header,
  footer,
  showPageNumbers,
  onHeaderChange,
  onFooterChange,
  onShowPageNumbersChange,
}: Props) {
  const [imageOpen, setImageOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [headerFooter, setHeaderFooter] = useState<'header' | 'footer' | null>(null)

  if (!editor) return <div className="h-[86px] animate-pulse bg-ink-50" />

  const inTable = editor.isActive('table')

  return (
    <div className="kw-ribbon-scroller">
      <RibbonGroup label="Illustrations">
        <RibbonButton
          icon={<ImageIcon size={16} />}
          label="Image"
          onClick={() => setImageOpen(true)}
          title="Insert image"
        />
      </RibbonGroup>

      <RibbonGroup label="Table">
        <Popover
          align="start"
          className="p-3"
          trigger={
            <button type="button" className="ribbon-button" title="Insert table">
              <Table2 size={16} className="text-ink-600" />
              <span className="ribbon-label">Table</span>
            </button>
          }
        >
          <TableSizePicker
            onPick={(rows, cols) => {
              editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
            }}
          />
        </Popover>
        <RibbonButton
          icon={<Rows3 size={15} />}
          label="Add row"
          disabled={!inTable}
          onClick={() => editor.chain().focus().addRowAfter().run()}
          showLabel={false}
          title="Add row below"
        />
        <RibbonButton
          icon={<Columns3 size={15} />}
          label="Add column"
          disabled={!inTable}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          showLabel={false}
          title="Add column to the right"
        />
        <RibbonButton
          icon={<Plus size={15} />}
          label="Toggle header row"
          disabled={!inTable}
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          showLabel={false}
          title="Toggle header row"
        />
        <RibbonButton
          icon={<Trash2 size={15} />}
          label="Delete table"
          disabled={!inTable}
          onClick={() => editor.chain().focus().deleteTable().run()}
          showLabel={false}
          title="Delete table"
        />
      </RibbonGroup>

      <RibbonGroup label="Links & rules">
        <RibbonButton icon={<Link2 size={16} />} label="Link" onClick={() => setLinkOpen(true)} title="Insert hyperlink" />
        <RibbonButton
          icon={<Minus size={16} />}
          label="Line"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal line"
        />
      </RibbonGroup>

      <RibbonGroup label="Insert">
        <RibbonButton
          icon={<CalendarDays size={16} />}
          label="Date"
          onClick={() => {
            const date = kannadaDate()
            editor.chain().focus().insertContent(date).run()
            toast('Kannada date inserted', date)
          }}
          title="Insert today's date in Kannada"
        />
        <RibbonButton
          icon={<span className="text-[13px] font-semibold leading-none">¶</span>}
          label="Page break"
          onClick={() => editor.chain().focus().setPageBreak().run()}
          title="Insert page break"
        />
      </RibbonGroup>

      <RibbonGroup label="Header & footer">
        <RibbonButton icon={<PanelTop size={16} />} label="Header" onClick={() => setHeaderFooter('header')} title="Edit header" />
        <RibbonButton icon={<PanelBottom size={16} />} label="Footer" onClick={() => setHeaderFooter('footer')} title="Edit footer" />
        <RibbonMenuButton icon={<Hash size={16} />} label="Page no." title="Page numbers">
          <div className="w-[200px]">
            <p className="px-2 pb-1 pt-1 text-[9.5px] font-semibold uppercase tracking-wide text-ink-400">
              Page numbers
            </p>
            <button
              type="button"
              className="kw-menu-item"
              onClick={() => {
                onFooterChange({ ...footer, enabled: true })
                onShowPageNumbersChange(true)
              }}
            >
              Bottom of page (footer)
            </button>
            <button
              type="button"
              className="kw-menu-item"
              onClick={() => {
                onHeaderChange({ ...header, enabled: true })
                onShowPageNumbersChange(true)
              }}
            >
              Top of page (header)
            </button>
            <button type="button" className="kw-menu-item" onClick={() => onShowPageNumbersChange(false)}>
              Remove page numbers
            </button>
          </div>
        </RibbonMenuButton>
      </RibbonGroup>

      <RibbonGroup label="Clipboard">
        <RibbonDivider />
        <RibbonButton
          icon={<span className="text-[12px]">T</span>}
          label="Text"
          onClick={() => {
            const text = editor.getText()
            if (!text) {
              toast('Document is empty')
              return
            }
            void navigator.clipboard.writeText(text).then(
              () => toast('Document text copied'),
              () => toast('Clipboard unavailable', undefined, 'error'),
            )
          }}
          title="Copy document text"
        />
      </RibbonGroup>

      <ImageDialog open={imageOpen} onOpenChange={setImageOpen} editor={editor} />
      <LinkDialog open={linkOpen} onOpenChange={setLinkOpen} editor={editor} />
      <HeaderFooterDialog
        open={headerFooter === 'header'}
        onOpenChange={(open) => setHeaderFooter(open ? 'header' : null)}
        kind="header"
        value={header}
        onChange={onHeaderChange}
        showPageNumbers={showPageNumbers}
        onShowPageNumbersChange={onShowPageNumbersChange}
      />
      <HeaderFooterDialog
        open={headerFooter === 'footer'}
        onOpenChange={(open) => setHeaderFooter(open ? 'footer' : null)}
        kind="footer"
        value={footer}
        onChange={onFooterChange}
        showPageNumbers={showPageNumbers}
        onShowPageNumbersChange={onShowPageNumbersChange}
      />
    </div>
  )
}
