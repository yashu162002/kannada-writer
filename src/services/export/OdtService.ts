import JSZip from 'jszip'
import type { ExportContext } from './types'
import { pageSizeMm } from '@/lib/page'

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

const NS = `xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
 xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
 xmlns:xlink="http://www.w3.org/1999/xlink"
 xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
 xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
 xmlns:dc="http://purl.org/dc/elements/1.1/"`

function esc(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

export async function buildOdt(context: ExportContext): Promise<Blob> {
  const textStyles = new Map<string, string>()
  const paragraphStyles = new Map<string, string>()
  const images: Array<{ path: string; mediaType: string; data: Uint8Array }> = []

  const styleFor = (name: string, properties: string) => {
    if (!textStyles.has(name)) {
      textStyles.set(name, `<style:style style:name="${name}" style:family="text">${properties}</style:style>`)
    }
    return name
  }

  const paragraphStyleFor = (attrs: Record<string, unknown> | undefined): string => {
    const align = String(attrs?.textAlign ?? 'left')
    const lineHeight = Number.parseFloat(String(attrs?.lineHeight ?? context.lineHeight)) || 1.75
    const spaceAfter = Number(attrs?.spaceAfter ?? 0)
    const indent = Number(attrs?.indent ?? 0)
    const key = `${align}|${lineHeight}|${spaceAfter}|${indent}`
    const name = `P_${paragraphStyles.size + 1}`
    if (!paragraphStyles.has(key)) {
      const alignXml =
        align === 'center'
          ? ' fo:text-align="center"'
          : align === 'right'
            ? ' fo:text-align="end"'
            : align === 'justify'
              ? ' fo:text-align="justify"'
              : ''
      const props = `<style:paragraph-properties${alignXml} fo:margin-bottom="${(spaceAfter / 96).toFixed(
        3,
      )}in" fo:line-height="${Math.round(lineHeight * 100)}%"${
        indent > 0 ? ` fo:margin-left="${(indent * 24) / 96}in"` : ''
      }/>`
      paragraphStyles.set(
        key,
        `<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="Standard">${props}</style:style>`,
      )
    }
    return name
  }

  const inline = (nodes: PmNode[] = []): string =>
    nodes
      .map((node) => {
        if (node.type === 'hardBreak') return '<text:line-break/>'
        if (node.type === 'image') {
          return imageXml(node)
        }
        if (node.type !== 'text') return node.content ? inline(node.content) : ''
        const marks = node.marks ?? []
        const styleParts: string[] = []
        if (marks.some((mark) => mark.type === 'bold')) styleParts.push('fo:font-weight="bold"')
        if (marks.some((mark) => mark.type === 'italic')) styleParts.push('fo:font-style="italic"')
        if (marks.some((mark) => mark.type === 'underline')) styleParts.push('style:text-underline-style="solid"')
        if (marks.some((mark) => mark.type === 'strike')) styleParts.push('style:text-line-through-style="solid"')
        if (marks.some((mark) => mark.type === 'superscript')) styleParts.push('style:text-position="super 58%"')
        if (marks.some((mark) => mark.type === 'subscript')) styleParts.push('style:text-position="sub 58%"')
        const textStyle = marks.find((mark) => mark.type === 'textStyle')
        const size = textStyle?.attrs?.fontSize
        if (size) {
          const pt = Number.parseFloat(String(size))
          if (Number.isFinite(pt)) styleParts.push(`fo:font-size="${pt}pt"`)
        }
        const color = textStyle?.attrs?.color
        if (color) styleParts.push(`fo:color="${String(color).replace('#', '')}"`)
        const highlight = marks.find((mark) => mark.type === 'highlight')?.attrs?.color
        if (highlight) styleParts.push(`fo:background-color="${String(highlight).replace('#', '')}"`)
        const escaped = esc(node.text ?? '')
        if (!styleParts.length) {
          const link = marks.find((mark) => mark.type === 'link')
          const href = link?.attrs?.href as string | undefined
          return href ? `<text:a xlink:type="simple" xlink:href="${esc(href)}">${escaped}</text:a>` : escaped
        }
        const styleName = styleFor(`T${textStyles.size + 1}`, `<style:text-properties ${styleParts.join(' ')}/>`)
        const link = marks.find((mark) => mark.type === 'link')
        const href = link?.attrs?.href as string | undefined
        const content = `<text:span text:style-name="${styleName}">${escaped}</text:span>`
        return href ? `<text:a xlink:type="simple" xlink:href="${esc(href)}">${content}</text:a>` : content
      })
      .join('')

  const imageXml = (node: PmNode): string => {
    const src = String(node.attrs?.src ?? '')
    if (!src.startsWith('data:image/')) return ''
    const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,(.*)$/.exec(src)
    if (!match) return ''
    const extension = match[1] === 'jpeg' ? 'jpg' : match[1]
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const index = images.length + 1
    const path = `Pictures/image${index}.${extension}`
    images.push({ path, mediaType: `image/${match[1]}`, data: bytes })
    const width = Number(node.attrs?.width ?? 320)
    const height = Number(node.attrs?.height ?? 200)
    return `<text:p text:style-name="P_center"><draw:frame draw:name="Image${index}" text:anchor-type="as-char" svg:width="${width}px" svg:height="${height}px"><draw:image xlink:href="${path}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame></text:p>`
  }

  const paragraph = (node: PmNode, styleOverride?: string): string =>
    `<text:p text:style-name="${styleOverride ?? paragraphStyleFor(node.attrs)}">${inline(node.content)}</text:p>`

  const listXml = (list: PmNode, depth = 0): string => {
    const ordered = list.type === 'orderedList'
    const items = (list.content ?? [])
      .map((item) => {
        const blocks = (item.content ?? [])
          .map((child) => {
            if (child.type === 'bulletList' || child.type === 'orderedList') return listXml(child, depth + 1)
            if (child.type === 'paragraph') return paragraph(child)
            return ''
          })
          .join('')
        return `<text:list-item>${blocks}</text:list-item>`
      })
      .join('')
    const styleName = ordered ? 'ListNumbered' : 'ListBullet'
    return `<text:list text:style-name="${styleName}">${items}</text:list>`
  }

  const tableXml = (table: PmNode): string => {
    const rows = table.content ?? []
    const columnCount = Math.max(1, rows[0]?.content?.length ?? 1)
    const rowXml = rows
      .map((row) => {
        const cells = (row.content ?? [])
          .map((cell) => {
            const blocks = (cell.content ?? [])
              .filter((child) => child.type === 'paragraph' || child.type === 'heading')
              .map((child) => paragraph(child))
              .join('')
            return `<table:table-cell office:value-type="string">${blocks || '<text:p/>'}</table:table-cell>`
          })
          .join('')
        return `<table:table-row>${cells}</table:table-row>`
      })
      .join('')
    return `<table:table table:name="Table${paragraphStyles.size + 1}"><table:table-column table:number-columns-repeated="${columnCount}"/>${rowXml}</table:table>`
  }

  const body: string[] = []
  for (const node of (context.json as PmNode).content ?? []) {
    switch (node.type) {
      case 'paragraph':
        body.push(paragraph(node))
        break
      case 'heading': {
        const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)))
        body.push(
          `<text:h text:outline-level="${level}" text:style-name="${paragraphStyleFor(node.attrs)}">${inline(
            node.content,
          )}</text:h>`,
        )
        break
      }
      case 'bulletList':
      case 'orderedList':
        body.push(listXml(node))
        break
      case 'blockquote':
        body.push(`<text:section text:name="Quote${body.length}" style:name="Quote">`)
        for (const child of node.content ?? []) {
          if (child.type === 'paragraph') body.push(paragraph(child))
        }
        body.push('</text:section>')
        break
      case 'codeBlock':
        body.push(
          `<text:p text:style-name="Preformatted_20_Text">${esc(
            node.content?.map((child) => child.text ?? '').join('\n') ?? '',
          )}</text:p>`,
        )
        break
      case 'horizontalRule':
        body.push('<text:p text:style-name="Horizontal_20_Line"/>')
        break
      case 'pageBreak':
        body.push('<text:p text:style-name="PageBreak"><text:soft-page-break/></text:p>')
        break
      case 'table':
        body.push(tableXml(node))
        break
      case 'image':
        body.push(imageXml(node))
        break
      default:
        break
    }
  }

  const automaticStyles = `<office:automatic-styles>
    ${[...textStyles.values()].join('\n')}
    ${[...paragraphStyles.values()].join('\n')}
    <style:style style:name="PageBreak" style:family="paragraph"><style:paragraph-properties fo:break-after="page"/></style:style>
    <style:style style:name="P_center" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/></style:style>
    <text:list-style style:name="ListBullet">
      <text:list-level-style-bullet text:level="1" text:bullet-char="•"><style:list-level-properties text:space-before="0.25in" text:min-label-width="0.25in"/></text:list-level-style-bullet>
      <text:list-level-style-bullet text:level="2" text:bullet-char="–"><style:list-level-properties text:space-before="0.5in" text:min-label-width="0.25in"/></text:list-level-style-bullet>
    </text:list-style>
    <text:list-style style:name="ListNumbered">
      <text:list-level-style-number text:level="1" style:num-format="1"><style:list-level-properties text:space-before="0.25in" text:min-label-width="0.3in"/></text:list-level-style-number>
      <text:list-level-style-number text:level="2" style:num-format="1"><style:list-level-properties text:space-before="0.5in" text:min-label-width="0.3in"/></text:list-level-style-number>
    </text:list-style>
  </office:automatic-styles>`

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS} office:version="1.3">
${automaticStyles}
<office:body><office:text>
${body.join('\n')}
</office:text></office:body>
</office:document-content>`

  const mm = pageSizeMm(context.settings)
  const margins = context.settings.margins
  const cm = (px: number) => ((px / 96) * 2.54).toFixed(2)

  const headerXml = context.header.enabled
    ? `<style:header><text:p text:style-name="Header">${esc(
        context.header.content.replaceAll('{title}', context.title),
      )}${context.showPageNumbers && !context.header.content.includes('{page}') ? ' — <text:page-number text:select-page="current"/>' : ''}</text:p></style:header>`
    : ''
  const footerXml =
    context.footer.enabled || context.showPageNumbers
      ? `<style:footer><text:p text:style-name="Footer">${esc(
          context.footer.content.replaceAll('{title}', context.title),
        )}${context.showPageNumbers && !context.footer.content.includes('{page}') ? ' — <text:page-number text:select-page="current"/>' : ''}</text:p></style:footer>`
      : ''

  const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${NS} office:version="1.3">
<office:styles>
  <style:default-style style:family="paragraph">
    <style:paragraph-properties fo:line-height="${Math.round(
      (Number.parseFloat(context.lineHeight) || 1.75) * 100,
    )}%"/>
    <style:text-properties style:font-name="Noto Sans Kannada" fo:font-size="${context.fontSize}pt"/>
  </style:default-style>
  <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
  <style:style style:name="Header" style:family="paragraph">
    <style:paragraph-properties fo:border-bottom="0.5pt solid #e5e9ec" fo:padding-bottom="2pt"/>
    <style:text-properties fo:font-size="9pt" fo:color="#667079"/>
  </style:style>
  <style:style style:name="Footer" style:family="paragraph">
    <style:paragraph-properties fo:border-top="0.5pt solid #e5e9ec" fo:padding-top="2pt"/>
    <style:text-properties fo:font-size="9pt" fo:color="#667079"/>
  </style:style>
  <style:style style:name="Preformatted_20_Text" style:family="paragraph" style:parent-style-name="Standard">
    <style:text-properties style:font-name="Consolas" fo:font-size="9pt"/>
  </style:style>
  <style:style style:name="Horizontal_20_Line" style:family="paragraph">
    <style:paragraph-properties fo:border-bottom="0.5pt solid #c8cfd5" fo:padding-bottom="4pt"/>
  </style:style>
</office:styles>
<office:automatic-styles>
  <style:page-layout style:name="pm1">
    <style:page-layout-properties fo:page-width="${mm.width}mm" fo:page-height="${mm.height}mm"
      style:print-orientation="${context.settings.orientation}"
      fo:margin-top="${cm(margins.top)}cm" fo:margin-bottom="${cm(margins.bottom)}cm"
      fo:margin-left="${cm(margins.left)}cm" fo:margin-right="${cm(margins.right)}cm"/>
  </style:page-layout>
</office:automatic-styles>
<office:master-styles>
  <style:master-page style:name="Standard" style:page-layout-name="pm1">
    ${headerXml}
    ${footerXml}
  </style:master-page>
</office:master-styles>
</office:document-styles>`

  const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta ${NS} office:version="1.3">
<office:meta>
  <dc:title>${esc(context.title)}</dc:title>
  <dc:creator>${esc(context.meta.author || 'Kannada Writer')}</dc:creator>
  <dc:description>${esc(context.meta.subject || '')}</dc:description>
  <meta:generator>Kannada Writer</meta:generator>
</office:meta>
</office:document-meta>`

  const manifestEntries = [
    '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>',
    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>',
    '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>',
    '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>',
    ...images.map(
      (image) =>
        `<manifest:file-entry manifest:full-path="${image.path}" manifest:media-type="${image.mediaType}"/>`,
    ),
  ]

  const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
${manifestEntries.join('\n')}
</manifest:manifest>`

  const zip = new JSZip()
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' })
  zip.file('content.xml', contentXml)
  zip.file('styles.xml', stylesXml)
  zip.file('meta.xml', metaXml)
  zip.file('META-INF/manifest.xml', manifestXml)
  for (const image of images) {
    zip.file(image.path, image.data)
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.oasis.opendocument.text',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}
