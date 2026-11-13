import { Node, mergeAttributes } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType
    }
  }
}

/**
 * Manual page break. Rendered as a visible divider in the editor and as a real
 * page break in print, PDF and DOCX output.
 */
export const PageBreakExtension = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-page-break': 'true',
        class: 'kw-page-break',
        contenteditable: 'false',
      }),
      ['span', { class: 'kw-page-break-label' }, 'Page break'],
    ]
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain, state }) => {
          const { $from } = state.selection
          // A block page break inside a table cell (or list item) would be
          // paginated with the table. Place it after the enclosing top-level
          // block instead.
          if ($from.depth > 1) {
            const position = $from.after(1)
            return chain().insertContentAt(position, { type: this.name }).focus().run()
          }
          // With a page break selected at the end of the document, insertContent
          // would replace that node with an identical one and appear to do nothing.
          if (state.selection instanceof NodeSelection && state.selection.node.type.name === this.name) {
            return chain().insertContentAt(state.selection.to, { type: this.name }).focus().run()
          }
          return chain().insertContent({ type: this.name }).run()
        },
    }
  },
})
