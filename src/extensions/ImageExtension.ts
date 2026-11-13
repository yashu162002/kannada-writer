import Image from '@tiptap/extension-image'

/**
 * Image node with explicit width/height attributes so sizing survives DOCX and
 * HTML export. Images are always stored as data URLs to keep exports offline.
 */
export const ResizableImageExtension = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute('width') || element.style.width
          if (!value) return null
          return Number.parseInt(value, 10) || null
        },
        renderHTML: (attributes) =>
          attributes.width ? { width: attributes.width, style: `width: ${attributes.width}px` } : {},
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute('height') || element.style.height
          if (!value) return null
          return Number.parseInt(value, 10) || null
        },
        renderHTML: (attributes) =>
          attributes.height ? { height: attributes.height, style: `height: ${attributes.height}px` } : {},
      },
    }
  },
}).configure({
  inline: false,
  allowBase64: true,
  HTMLAttributes: { class: 'kw-doc-image' },
})
