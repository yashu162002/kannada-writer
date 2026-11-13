import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LineRuleType,
  PageBreak,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  type IRunOptions,
} from 'docx'
import type { ExportContext } from './types'
import { getPageMetrics } from '@/lib/page'

interface PmMark {
  type: string
  attrs?: Record<string, unknown>
}

interface PmNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: PmMark[]
  content?: PmNode[]
}

const ALIGNMENTS: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
}

const HIGHLIGHTS = ['yellow', 'green', 'cyan', 'magenta', 'blue', 'red', 'darkBlue', 'darkCyan', 'darkGreen', 'darkMagenta', 'darkRed', 'darkYellow', 'lightGray', 'black'] as const

function mapHighlight(color: string | undefined): (typeof HIGHLIGHTS)[number] | undefined {
  if (!color) return undefined
  const hex = color.replace('#', '').toLowerCase()
  if (hex === 'fef08a' || hex === 'fef9c3' || hex === 'ffff00') return 'yellow'
  if (hex.startsWith('dcfce7') || hex === 'bbf7d0' || hex === '00ff00') return 'green'
  if (hex.startsWith('cffafe') || hex === 'a5f3fc') return 'cyan'
  if (hex.startsWith('fce7f3') || hex === 'fbcfe8') return 'magenta'
  if (hex.startsWith('fee2e2') || hex === 'fecaca') return 'red'
  if (hex === 'f3f4f6') return 'lightGray'
  return 'yellow'
}

function runOptions(node: PmNode, context: ExportContext, mark: PmMark | null): IRunOptions {
  const marks = node.marks ?? []
  const textStyle = marks.find((item) => item.type === 'textStyle')
  const fontFamily = (textStyle?.attrs?.fontFamily as string | undefined) ?? context.fontFamily
  const fontSize = Number.parseFloat(String(textStyle?.attrs?.fontSize ?? `${context.fontSize}pt`))
  const highlight = marks.find((item) => item.type === 'highlight')
  const color = textStyle?.attrs?.color as string | undefined

  return {
    text: node.text ?? '',
    bold: marks.some((item) => item.type === 'bold'),
    italics: marks.some((item) => item.type === 'italic'),
    strike: marks.some((item) => item.type === 'strike'),
    underline: marks.some((item) => item.type === 'underline') ? { type: UnderlineType.SINGLE } : undefined,
    superScript: marks.some((item) => item.type === 'superscript') || undefined,
    subScript: marks.some((item) => item.type === 'subscript') || undefined,
    font: fontFamily,
    size: Number.isFinite(fontSize) ? Math.round(fontSize * 2) : context.fontSize * 2,
    color: color ? color.replace('#', '').toUpperCase() : undefined,
    highlight: mapHighlight(highlight?.attrs?.color as string | undefined),
  }
}

function inlineRuns(nodes: PmNode[], context: ExportContext): Array<TextRun | ExternalHyperlink> {
  const output: Array<TextRun | ExternalHyperlink> = []
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      output.push(new TextRun({ break: 1 }))
      continue
    }
    if (node.type !== 'text') {
      if (node.content) output.push(...inlineRuns(node.content, context))
      continue
    }
    const link = node.marks?.find((item) => item.type === 'link')
    const href = link?.attrs?.href as string | undefined
    const run = new TextRun(
      href
        ? {
            ...runOptions(node, context, link ?? null),
            color: '0B61A4',
            underline: { type: UnderlineType.SINGLE },
          }
        : runOptions(node, context, null),
    )
    if (href) {
      output.push(new ExternalHyperlink({ link: href, children: [run] }))
    } else {
      output.push(run)
    }
  }
  return output
}

function paragraphFromNode(
  node: PmNode,
  context: ExportContext,
  options: { numbering?: { reference: string; level: number; instance?: number }; bullet?: { level: number } } = {},
): Paragraph {
  const level = Number(node.attrs?.level ?? 0)
  const lineHeight = Number.parseFloat(String(node.attrs?.lineHeight ?? context.lineHeight)) || 1.75
  const spacingAfter = Number(node.attrs?.spaceAfter ?? 0)
  const indent = Number(node.attrs?.indent ?? 0)
  const alignment = ALIGNMENTS[String(node.attrs?.textAlign ?? 'left')]

  return new Paragraph({
    children: inlineRuns(node.content ?? [], context),
    alignment,
    heading:
      node.type === 'heading'
        ? level === 1
          ? HeadingLevel.HEADING_1
          : level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3
        : undefined,
    spacing: {
      line: Math.round(240 * lineHeight),
      lineRule: LineRuleType.AUTO,
      after: Math.round(spacingAfter * 15),
      before: node.type === 'heading' ? 240 : 0,
    },
    indent: indent > 0 ? { left: indent * 360 } : undefined,
    ...options,
  })
}

function listParagraphs(
  list: PmNode,
  context: ExportContext,
  level: number,
  orderedInstance: { value: number },
): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const ordered = list.type === 'orderedList'
  orderedInstance.value += 1
  const instance = orderedInstance.value
  for (const item of list.content ?? []) {
    const inlineNodes = (item.content ?? []).filter((child) => child.type !== 'bulletList' && child.type !== 'orderedList')
    const nested = (item.content ?? []).filter((child) => child.type === 'bulletList' || child.type === 'orderedList')
    for (const block of inlineNodes) {
      if (block.type === 'paragraph' || block.type === 'heading') {
        paragraphs.push(
          paragraphFromNode(block, context, {
            ...(ordered
              ? { numbering: { reference: 'kw-numbering', level, instance } }
              : { bullet: { level } }),
          }),
        )
      }
    }
    for (const child of nested) {
      paragraphs.push(...listParagraphs(child, context, level + 1, orderedInstance))
    }
  }
  return paragraphs
}

function tableFromNode(node: PmNode, context: ExportContext): Table {
  const rows = (node.content ?? []).map((row) => {
    const cells = (row.content ?? []).map((cell) => {
      const blocks = (cell.content ?? []).filter((child) => child.type === 'paragraph' || child.type === 'heading')
      const children =
        blocks.length > 0
          ? blocks.map((block) => paragraphFromNode(block, context))
          : [new Paragraph({ children: [new TextRun({ text: '' })] })]
      return new TableCell({
        children,
        shading: {
          fill: cell.type === 'tableHeader' ? 'F2F5F6' : 'FFFFFF',
        },
      })
    })
    return new TableRow({ children: cells })
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'B7C0C7' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'B7C0C7' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'B7C0C7' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'B7C0C7' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'B7C0C7' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'B7C0C7' },
    },
    rows,
  })
}

function imageParagraph(node: PmNode, context: ExportContext): Paragraph | null {
  const src = String(node.attrs?.src ?? '')
  if (!src.startsWith('data:image/')) return null
  const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,/.exec(src)
  const rawType = match?.[1]?.toLowerCase() ?? 'png'
  const type = rawType === 'jpeg' ? 'jpg' : rawType === 'gif' ? 'gif' : rawType === 'bmp' ? 'bmp' : 'png'
  const specifiedWidth = Number(node.attrs?.width ?? 0)
  const specifiedHeight = Number(node.attrs?.height ?? 0)
  const maxWidth = getPageMetrics(context.settings).contentWidth
  const width = specifiedWidth > 0 ? Math.min(specifiedWidth, maxWidth) : Math.min(440, maxWidth)
  const height = specifiedHeight > 0 ? specifiedHeight : Math.round(width * 0.66)
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new ImageRun({
        type,
        data: src,
        transformation: { width, height },
        altText: {
          name: String(node.attrs?.alt ?? 'Document image'),
          description: String(node.attrs?.alt ?? ''),
          title: String(node.attrs?.alt ?? ''),
        },
      }),
    ],
  })
}

function fieldRuns(template: string, showNumber: boolean): Array<TextRun> {
  const runs: Array<TextRun> = []
  const parts = template.split(/(\{page\}|\{pages\}|\{title\}|\{date\})/g)
  for (const part of parts) {
    if (!part) continue
    if (part === '{page}') runs.push(new TextRun({ children: [PageNumber.CURRENT] }))
    else if (part === '{pages}') runs.push(new TextRun({ children: [PageNumber.TOTAL_PAGES] }))
    else if (part === '{date}') runs.push(new TextRun(new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date())))
    else runs.push(new TextRun(part))
  }
  if (showNumber && !template.includes('{page}')) {
    runs.push(new TextRun('  ·  Page '))
    runs.push(new TextRun({ children: [PageNumber.CURRENT] }))
    runs.push(new TextRun(' of '))
    runs.push(new TextRun({ children: [PageNumber.TOTAL_PAGES] }))
  }
  return runs
}

export async function buildDocx(context: ExportContext): Promise<Blob> {
  const root = context.json as PmNode
  const children: Array<Paragraph | Table> = []
  const orderedInstance = { value: 0 }
  let pendingPageBreak = false

  const push = (item: Paragraph | Table) => {
    if (pendingPageBreak && item instanceof Paragraph) {
      children.push(new Paragraph({ children: [], pageBreakBefore: true }))
      pendingPageBreak = false
    }
    children.push(item)
  }

  for (const node of root.content ?? []) {
    switch (node.type) {
      case 'paragraph':
      case 'heading':
        push(paragraphFromNode(node, context))
        break
      case 'bulletList':
      case 'orderedList':
        for (const paragraph of listParagraphs(node, context, 0, orderedInstance)) {
          children.push(paragraph)
        }
        break
      case 'blockquote': {
        for (const child of node.content ?? []) {
          if (child.type === 'paragraph') {
            children.push(
              new Paragraph({
                children: inlineRuns(child.content ?? [], context),
                indent: { left: 480 },
                border: {
                  left: { style: BorderStyle.SINGLE, size: 12, color: 'B9C2C9', space: 8 },
                },
                spacing: { after: 120 },
              }),
            )
          }
        }
        break
      }
      case 'codeBlock': {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: node.content?.map((child) => child.text ?? '').join('\n') ?? '', font: 'Consolas', size: 22 })],
            shading: { fill: 'F4F6F8' },
            spacing: { after: 120 },
          }),
        )
        break
      }
      case 'horizontalRule':
        children.push(
          new Paragraph({
            children: [],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C8CFD5', space: 1 } },
            spacing: { after: 160 },
          }),
        )
        break
      case 'pageBreak':
        pendingPageBreak = true
        break
      case 'table':
        push(tableFromNode(node, context))
        break
      case 'image': {
        const paragraph = imageParagraph(node, context)
        if (paragraph) push(paragraph)
        break
      }
      default:
        break
    }
  }

  // A trailing page break should still produce a break, so add an empty paragraph.
  if (pendingPageBreak) {
    children.push(new Paragraph({ children: [new PageBreak()] }))
  }

  if (!children.length) {
    children.push(new Paragraph({ children: [new TextRun('')] }))
  }

  const metrics = getPageMetrics(context.settings)
  const landscape = metrics.pageWidth > metrics.pageHeight
  const pageSize = {
    width: Math.round(metrics.pageWidth * 15),
    height: Math.round(metrics.pageHeight * 15),
    orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
  }
  const margins = {
    top: Math.round(metrics.paddingTop * 15),
    right: Math.round(metrics.paddingRight * 15),
    bottom: Math.round(metrics.paddingBottom * 15),
    left: Math.round(metrics.paddingLeft * 15),
  }

  const headerEnabled = context.header.enabled
  const footerEnabled = context.footer.enabled || context.showPageNumbers
  const headerContent = context.header.content.replaceAll('{title}', context.title)
  const footerContent = context.footer.content.replaceAll('{title}', context.title)

  const doc = new Document({
    title: context.title,
    subject: context.meta.subject,
    creator: context.meta.author || 'Kannada Writer',
    description: 'Created with Kannada Writer',
    styles: {
      default: {
        document: {
          run: { font: context.fontFamily, size: context.fontSize * 2 },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'kw-numbering',
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: level === 0 ? '%1.' : level === 1 ? '%2.' : '%3.',
            alignment: AlignmentType.START,
            style: {
              paragraph: {
                indent: { left: 720 + level * 360, hanging: 360 },
              },
            },
          })),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: pageSize, margin: margins },
        },
        headers: headerEnabled
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    children: fieldRuns(headerContent, context.showPageNumbers),
                    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E9EC', space: 4 } },
                  }),
                ],
              }),
            }
          : undefined,
        footers: footerEnabled
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: fieldRuns(footerContent, context.showPageNumbers),
                    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E9EC', space: 4 } },
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}
