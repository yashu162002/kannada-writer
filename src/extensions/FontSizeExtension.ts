import { Extension } from '@tiptap/core'
import '@tiptap/extension-text-style'

export interface FontSizeOptions {
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

/**
 * Custom font-size mark. Stores pt sizes (as used by Word) and renders them
 * as px-equivalents so the canvas matches the printed proportions.
 */
export const FontSizeExtension = Extension.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => {
              const raw = element.style.fontSize
              if (!raw) return null
              if (raw.endsWith('pt')) return `${parseFloat(raw)}pt`
              if (raw.endsWith('px')) return `${Math.round((parseFloat(raw) * 72) / 96)}pt`
              return raw
            },
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              const value = String(attributes.fontSize)
              const pt = parseFloat(value)
              return { style: `font-size: ${Number.isFinite(pt) ? (pt * 96) / 72 : 14}px` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})
