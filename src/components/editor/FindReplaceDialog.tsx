import { useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Dialog } from '@/components/common/Dialog'
import { Button } from '@/components/common/Button'
import { toast } from '@/components/common/Toast'

interface Match {
  from: number
  to: number
}

function findMatches(editor: Editor, query: string): Match[] {
  const matches: Match[] = []
  const needle = query.toLowerCase()
  if (!needle) return matches
  editor.state.doc.descendants((node, position) => {
    if (!node.isText || !node.text) return
    const haystack = node.text.toLowerCase()
    let index = haystack.indexOf(needle)
    while (index !== -1) {
      matches.push({ from: position + index, to: position + index + needle.length })
      index = haystack.indexOf(needle, index + needle.length)
    }
  })
  return matches
}

export function FindReplaceDialog({
  open,
  onOpenChange,
  editor,
  initialMode = 'find',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editor: Editor | null
  initialMode?: 'find' | 'replace'
}) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!open || !editor) return
    const handler = () => setVersion((value) => value + 1)
    editor.on('update', handler)
    return () => {
      editor.off('update', handler)
    }
  }, [open, editor])

  const matches = useMemo(() => {
    if (!open || !editor) return []
    void version
    return findMatches(editor, query)
  }, [open, editor, query, version])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const selectMatch = (index: number) => {
    if (!editor || !matches.length) return
    const safe = ((index % matches.length) + matches.length) % matches.length
    const match = matches[safe]
    editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run()
    setActiveIndex(safe)
  }

  const replaceCurrent = () => {
    if (!editor) return
    if (!matches.length) {
      toast('No matches', `"${query}" was not found.`)
      return
    }
    const match = matches[activeIndex] ?? matches[0]
    editor.chain().focus().insertContentAt({ from: match.from, to: match.to }, replacement).run()
    setVersion((value) => value + 1)
    toast('Replaced match')
  }

  const replaceAll = () => {
    if (!editor) return
    if (!matches.length) {
      toast('No matches', `"${query}" was not found.`)
      return
    }
    const { tr } = editor.state
    for (let index = matches.length - 1; index >= 0; index--) {
      const match = matches[index]
      try {
        const marks = editor.state.doc.resolve(match.from).marks()
        tr.replaceWith(match.from, match.to, editor.schema.text(replacement, marks))
      } catch {
        /* skip positions that no longer resolve */
      }
    }
    editor.view.dispatch(tr)
    toast(`Replaced ${matches.length} matches`)
    setVersion((value) => value + 1)
  }

  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={initialMode === 'replace' ? 'Find and replace' : 'Find'}
      description="Search the current document. Matches are case-insensitive."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" size="sm" onClick={replaceAll} disabled={!matches.length}>
            Replace all
          </Button>
          <Button size="sm" onClick={() => selectMatch(activeIndex + 1)} disabled={!matches.length}>
            Find next
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="kw-label" htmlFor="find-query">
            Find
          </label>
          <input
            id="find-query"
            className="kw-input"
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                selectMatch(activeIndex + (event.shiftKey ? -1 : 1))
              }
            }}
            placeholder="Type a Kannada or English word"
          />
        </div>
        <div>
          <label className="kw-label" htmlFor="find-replacement">
            Replace with
          </label>
          <input
            id="find-replacement"
            className="kw-input"
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            placeholder="Replacement text"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-[11.5px] text-ink-600">
          <span>
            {matches.length
              ? `${matches.length} match${matches.length === 1 ? '' : 'es'} · showing ${activeIndex + 1}`
              : query
                ? 'No matches'
                : 'Type to search'}
          </span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={!matches.length} onClick={() => selectMatch(activeIndex - 1)}>
              Previous
            </Button>
            <Button size="sm" disabled={!matches.length} onClick={replaceCurrent}>
              Replace
            </Button>
          </div>
        </div>
        <p className="text-[10.5px] text-ink-400">
          Shortcut: {isMac ? '⌘F' : 'Ctrl+F'} to find · {isMac ? '⌘H' : 'Ctrl+H'} to replace
        </p>
      </div>
    </Dialog>
  )
}
