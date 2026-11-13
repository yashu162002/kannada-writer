import { useEffect, useReducer } from 'react'
import type { Editor } from '@tiptap/react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ClipboardPaste,
  Copy,
  Eraser,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Minus,
  Palette,
  Pilcrow,
  Plus,
  Quote,
  Redo2,
  Scissors,
  Strikethrough,
  Subscript,
  Superscript,
  Type,
  Underline,
  Undo2,
  ChevronDown,
} from 'lucide-react'
import { FONT_SIZE_OPTIONS } from '@/types/document'
import { FontFamilyButton, FontSizeSelect, ColorSwatches } from './FontSelector'
import { RibbonButton, RibbonDivider, RibbonGroup, RibbonMenuButton } from './RibbonShared'
import { getFontStack } from '@/lib/fonts'
import { toast } from '@/components/common/Toast'
import { Popover } from '@/components/common/Dropdown'
import { cn } from '@/lib/utils'

interface Props {
  editor: Editor | null
  defaultFont: string
  defaultFontSize: number
  onDefaultFontChange: (font: string) => void
  onDefaultFontSizeChange: (size: number) => void
}

export function EditorToolbar({
  editor,
  defaultFont,
  defaultFontSize,
  onDefaultFontChange,
  onDefaultFontSizeChange,
}: Props) {
  const [, force] = useReducer((value: number) => value + 1, 0)

  useEffect(() => {
    if (!editor) return
    const handler = () => force()
    editor.on('transaction', handler)
    editor.on('selectionUpdate', handler)
    return () => {
      editor.off('transaction', handler)
      editor.off('selectionUpdate', handler)
    }
  }, [editor])

  if (!editor) {
    return <div className="h-[86px] animate-pulse bg-ink-50" />
  }

  const textStyle = editor.getAttributes('textStyle')
  const currentFont = (textStyle.fontFamily as string | undefined) ?? defaultFont
  const currentSize = Number.parseFloat(String(textStyle.fontSize ?? `${defaultFontSize}pt`)) || defaultFontSize
  const currentColor = (textStyle.color as string | undefined) ?? '#161a1f'
  const highlightColor = (editor.getAttributes('highlight').color as string | undefined) ?? '#fef08a'
  const paragraphAttrs = editor.getAttributes('paragraph')
  const currentLineHeight = String(paragraphAttrs.lineHeight ?? '1.75')
  const indentLevel = Number(paragraphAttrs.indent ?? 0)
  const emptySelection = editor.state.selection.empty

  const applyFont = (font: string) => {
    if (emptySelection) onDefaultFontChange(font)
    editor.chain().focus().setFontFamily(font).run()
    if (emptySelection) {
      // also update the closest paragraph so existing text keeps context
      editor.chain().focus().updateAttributes('paragraph', {}).run()
    }
  }

  const applySize = (size: number) => {
    if (emptySelection) onDefaultFontSizeChange(size)
    editor.chain().focus().setFontSize(`${size}pt`).run()
  }

  const copySelection = async () => {
    const text = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, '\n')
    if (!text) {
      toast('Nothing selected', 'Select text first, then copy.')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied to clipboard')
    } catch {
      toast('Clipboard unavailable', 'Your browser blocked clipboard access.', 'error')
    }
  }

  const cutSelection = async () => {
    const text = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, '\n')
    if (!text) {
      toast('Nothing selected', 'Select text first, then cut.')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      editor.chain().focus().deleteSelection().run()
    } catch {
      toast('Clipboard unavailable', 'Your browser blocked clipboard access.', 'error')
    }
  }

  const pasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) editor.chain().focus().insertContent(text).run()
    } catch {
      toast('Clipboard unavailable', 'Use Ctrl+V to paste.', 'error')
    }
  }

  const styleLabel = editor.isActive('heading', { level: 1 })
    ? 'Heading 1'
    : editor.isActive('heading', { level: 2 })
      ? 'Heading 2'
      : editor.isActive('heading', { level: 3 })
        ? 'Heading 3'
        : editor.isActive('blockquote')
          ? 'Quote'
          : 'Normal'

  return (
    <div className="kw-ribbon-scroller">
      {/* Clipboard */}
      <RibbonGroup label="Clipboard">
        <RibbonButton icon={<Scissors size={15} />} label="Cut" onClick={cutSelection} showLabel={false} title="Cut (Ctrl+X)" />
        <RibbonButton icon={<Copy size={15} />} label="Copy" onClick={copySelection} showLabel={false} title="Copy (Ctrl+C)" />
        <RibbonButton
          icon={<ClipboardPaste size={15} />}
          label="Paste"
          onClick={pasteClipboard}
          showLabel={false}
          title="Paste (Ctrl+V)"
        />
        <RibbonDivider />
        <RibbonButton
          icon={<Undo2 size={15} />}
          label="Undo"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          showLabel={false}
          title="Undo (Ctrl+Z)"
        />
        <RibbonButton
          icon={<Redo2 size={15} />}
          label="Redo"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          showLabel={false}
          title="Redo (Ctrl+Y)"
        />
      </RibbonGroup>

      {/* Styles */}
      <RibbonGroup label="Styles">
        <Popover
          align="start"
          className="w-[200px] p-1"
          trigger={
            <button type="button" className="ribbon-select flex w-[122px] items-center justify-between gap-1">
              <span className="truncate">{styleLabel}</span>
              <ChevronDown size={12} className="shrink-0 text-ink-400" />
            </button>
          }
        >
          {[
            { label: 'Normal text', icon: <Pilcrow size={13} />, run: () => editor.chain().focus().setParagraph().run() },
            { label: 'Heading 1', icon: <Type size={13} />, run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
            { label: 'Heading 2', icon: <Type size={13} />, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
            { label: 'Heading 3', icon: <Type size={13} />, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
            { label: 'Quote', icon: <Quote size={13} />, run: () => editor.chain().focus().toggleBlockquote().run() },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.run}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-ink-700 hover:bg-ink-100"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </Popover>
      </RibbonGroup>

      {/* Font */}
      <RibbonGroup label="Font">
        <FontFamilyButton value={currentFont} onChange={applyFont} />
        <FontSizeSelect value={currentSize} onChange={applySize} sizes={FONT_SIZE_OPTIONS} />
        <RibbonButton
          icon={<Bold size={15} />}
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          showLabel={false}
          title="Bold (Ctrl+B)"
        />
        <RibbonButton
          icon={<Italic size={15} />}
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          showLabel={false}
          title="Italic (Ctrl+I)"
        />
        <RibbonButton
          icon={<Underline size={15} />}
          label="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          showLabel={false}
          title="Underline (Ctrl+U)"
        />
        <RibbonButton
          icon={<Strikethrough size={15} />}
          label="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          showLabel={false}
          title="Strikethrough"
        />
        <RibbonButton
          icon={<Superscript size={15} />}
          label="Superscript"
          active={editor.isActive('superscript')}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          showLabel={false}
          title="Superscript"
        />
        <RibbonButton
          icon={<Subscript size={15} />}
          label="Subscript"
          active={editor.isActive('subscript')}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          showLabel={false}
          title="Subscript"
        />
        <Popover
          align="start"
          className="p-2"
          trigger={
            <button type="button" className="ribbon-button ribbon-button-icon" title="Text color">
              <span className="flex flex-col items-center gap-0.5">
                <Palette size={15} className="text-ink-600" />
                <span className="h-[3px] w-4 rounded-sm" style={{ background: currentColor }} />
              </span>
            </button>
          }
        >
          <ColorSwatches onPick={(color) => editor.chain().focus().setColor(color).run()} />
        </Popover>
        <Popover
          align="start"
          className="p-2"
          trigger={
            <button type="button" className="ribbon-button ribbon-button-icon" title="Text highlight">
              <span className="flex flex-col items-center gap-0.5">
                <Highlighter size={15} className="text-ink-600" />
                <span className="h-[3px] w-4 rounded-sm" style={{ background: highlightColor }} />
              </span>
            </button>
          }
        >
          <ColorSwatches
            includeNone
            onNone={() => editor.chain().focus().unsetHighlight().run()}
            onPick={(color) => editor.chain().focus().setHighlight({ color }).run()}
          />
        </Popover>
        <RibbonButton
          icon={<Eraser size={15} />}
          label="Clear formatting"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          showLabel={false}
          title="Clear formatting"
        />
      </RibbonGroup>

      {/* Paragraph */}
      <RibbonGroup label="Paragraph">
        <RibbonButton
          icon={<AlignLeft size={15} />}
          label="Align left"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          showLabel={false}
          title="Align left"
        />
        <RibbonButton
          icon={<AlignCenter size={15} />}
          label="Align center"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          showLabel={false}
          title="Align center"
        />
        <RibbonButton
          icon={<AlignRight size={15} />}
          label="Align right"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          showLabel={false}
          title="Align right"
        />
        <RibbonButton
          icon={<AlignJustify size={15} />}
          label="Justify"
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          showLabel={false}
          title="Justify"
        />
        <RibbonDivider />
        <RibbonButton
          icon={<List size={15} />}
          label="Bullets"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          showLabel={false}
          title="Bulleted list"
        />
        <RibbonButton
          icon={<ListOrdered size={15} />}
          label="Numbering"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          showLabel={false}
          title="Numbered list"
        />
        <RibbonButton
          icon={<IndentDecrease size={15} />}
          label="Decrease indent"
          onClick={() => editor.chain().focus().setIndent(Math.max(0, indentLevel - 1)).run()}
          showLabel={false}
          title="Decrease indent"
        />
        <RibbonButton
          icon={<IndentIncrease size={15} />}
          label="Increase indent"
          onClick={() => editor.chain().focus().setIndent(indentLevel + 1).run()}
          showLabel={false}
          title="Increase indent"
        />
        <Popover
          align="start"
          className="w-[180px] p-1"
          trigger={
            <button type="button" className="ribbon-select flex w-[86px] items-center justify-between gap-1" title="Line spacing">
              <span>{currentLineHeight}×</span>
              <ChevronDown size={12} className="text-ink-400" />
            </button>
          }
        >
          <p className="px-2 pb-1 pt-1 text-[9.5px] font-semibold uppercase tracking-wide text-ink-400">Line spacing</p>
          {[
            { label: '1.0', value: '1' },
            { label: '1.15', value: '1.15' },
            { label: '1.5', value: '1.5' },
            { label: '2.0', value: '2' },
            { label: 'Default (1.75)', value: '1.75' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => editor.chain().focus().setLineHeight(option.value).run()}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-ink-100',
                currentLineHeight === option.value ? 'text-brand-700' : 'text-ink-700',
              )}
            >
              {option.label}
              {currentLineHeight === option.value ? <span className="text-[9px]">active</span> : null}
            </button>
          ))}
        </Popover>
        <Popover
          align="start"
          className="w-[190px] p-1"
          trigger={
            <button type="button" className="ribbon-button ribbon-button-icon" title="Paragraph spacing">
              <span className="flex items-center gap-0.5">
                <Plus size={13} className="text-ink-600" />
                <Minus size={13} className="text-ink-600" />
              </span>
            </button>
          }
        >
          <p className="px-2 pb-1 pt-1 text-[9.5px] font-semibold uppercase tracking-wide text-ink-400">
            Space after paragraph
          </p>
          {[0, 4, 8, 12, 16, 24].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => editor.chain().focus().setParagraphSpacing(value).run()}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] text-ink-700 hover:bg-ink-100"
            >
              <span>{value === 0 ? 'None' : `${value} px`}</span>
              <span className="text-[10px] text-ink-400">after</span>
            </button>
          ))}
        </Popover>
      </RibbonGroup>

      <RibbonGroup label="Preview">
        <div
          className="hidden max-w-[180px] items-center truncate rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-[11px] text-ink-500 xl:flex"
          style={{ fontFamily: getFontStack(currentFont), minHeight: 30 }}
        >
          ಕನ್ನಡ ಬರವಣಿಗೆ
        </div>
      </RibbonGroup>
    </div>
  )
}
