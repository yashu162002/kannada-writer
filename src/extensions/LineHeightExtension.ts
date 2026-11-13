import { Extension } from '@tiptap/core'

export interface LineHeightOptions {
  types: string[]
  defaultLineHeight: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (value: string) => ReturnType
      unsetLineHeight: () => ReturnType
      setParagraphSpacing: (value: number) => ReturnType
      setIndent: (level: number) => ReturnType
    }
  }
}

/**
 * Paragraph-level typography: line spacing, paragraph spacing and left indent.
 * Values are rendered inline so they survive HTML/DOCX export pipelines.
 */
export const LineHeightExtension = Extension.create<LineHeightOptions>({
  name: 'lineHeight',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'listItem'],
      defaultLineHeight: '1.75',
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) =>
              attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
          },
          spaceAfter: {
            default: null,
            parseHTML: (element) => {
              const value = element.style.marginBottom
              return value ? value.replace('px', '') : null
            },
            renderHTML: (attributes) =>
              attributes.spaceAfter !== null && attributes.spaceAfter !== undefined
                ? { style: `margin-bottom: ${attributes.spaceAfter}px` }
                : {},
          },
          indent: {
            default: null,
            parseHTML: (element) => {
              const value = element.style.marginLeft
              return value ? value.replace('px', '') : null
            },
            renderHTML: (attributes) =>
              attributes.indent && Number(attributes.indent) > 0
                ? { style: `margin-left: ${Number(attributes.indent) * 24}px` }
                : {},
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setLineHeight:
        (value: string) =>
        ({ commands }) => {
          let applied = false
          for (const type of this.options.types) {
            applied = commands.updateAttributes(type, { lineHeight: value }) || applied
          }
          return applied
        },
      unsetLineHeight:
        () =>
        ({ commands }) => {
          let applied = false
          for (const type of this.options.types) {
            applied = commands.updateAttributes(type, { lineHeight: null }) || applied
          }
          return applied
        },
      setParagraphSpacing:
        (value: number) =>
        ({ commands }) => commands.updateAttributes('paragraph', { spaceAfter: value }),
      setIndent:
        (level: number) =>
        ({ commands }) => commands.updateAttributes('paragraph', { indent: Math.max(0, Math.min(8, level)) }),
    }
  },
})
