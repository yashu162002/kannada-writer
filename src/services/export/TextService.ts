import type { ExportContext } from './types'
import { getPageMetrics, pageSizeMm } from '@/lib/page'

export function buildTxt(context: ExportContext): string {
  return `${context.title}\n${'='.repeat(Math.min(context.title.length, 60))}\n\n${context.text}\n`
}

async function embeddedKannadaFont(): Promise<string> {
  try {
    const response = await fetch('/fonts/noto-sans-kannada.woff2')
    if (!response.ok) return ''
    const buffer = await response.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
  } catch {
    return ''
  }
}

export async function buildHtml(context: ExportContext): Promise<string> {
  const font = await embeddedKannadaFont()
  const mm = pageSizeMm(context.settings)
  const metrics = getPageMetrics(context.settings)
  const header = context.header.enabled
    ? `<header class="doc-header">${escapeHtml(context.header.content.replaceAll('{title}', context.title))}</header>`
    : ''
  const footer =
    context.footer.enabled || context.showPageNumbers
      ? `<footer class="doc-footer"><span>${escapeHtml(
          context.footer.content.replaceAll('{title}', context.title),
        )}</span></footer>`
      : ''

  return `<!doctype html>
<html lang="kn">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(context.title)}</title>
<meta name="author" content="${escapeHtml(context.meta.author ?? '')}" />
<style>
  @font-face {
    font-family: 'Noto Sans Kannada';
    src: url(data:font/woff2;base64,${font}) format('woff2');
    font-weight: 100 900;
    font-display: swap;
  }
  :root { color-scheme: light; }
  body {
    margin: 0;
    background: #eef0f2;
    font-family: '${context.fontFamily.replace(/'/g, '')}', 'Noto Sans Kannada', 'Nirmala UI', sans-serif;
    font-size: ${context.fontSize}px;
    line-height: ${context.lineHeight};
    color: #161a1f;
  }
  .sheet {
    box-sizing: border-box;
    width: ${metrics.pageWidth}px;
    min-height: ${metrics.pageHeight}px;
    margin: 24px auto;
    padding: ${metrics.paddingTop}px ${metrics.paddingRight}px ${metrics.paddingBottom}px ${metrics.paddingLeft}px;
    background: #fff;
    box-shadow: 0 2px 18px rgba(16,24,40,.10);
  }
  .doc-header { border-bottom: 1px solid #e5e9ec; padding-bottom: 6px; margin-bottom: 14px; color: #667079; font-size: 11px; }
  .doc-footer { border-top: 1px solid #e5e9ec; padding-top: 6px; margin-top: 18px; color: #667079; font-size: 11px; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #b7c0c7; padding: 5px 8px; vertical-align: top; }
  th { background: #f2f5f6; }
  blockquote { border-left: 3px solid #b9c2c9; margin: 1em 0; padding-left: 14px; color: #3a434e; }
  .kw-page-break { display: none; }
  hr { border: 0; border-top: 1px solid #c8cfd5; margin: 1em 0; }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; box-shadow: none; width: auto; min-height: 0; padding: 0; }
    @page { size: ${mm.width}mm ${mm.height}mm; margin: ${Math.round(metrics.paddingTop / 96 * 25.4)}mm; }
  }
</style>
</head>
<body>
<main class="sheet">
${header}
${context.html}
${footer}
</main>
</body>
</html>
`
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/* ── RTF ─────────────────────────────────────────────────────────────────── */

interface RtfNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  content?: RtfNode[]
}

function rtfUnicode(text: string): string {
  let out = ''
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (char === '\n') {
      out += '\\line '
    } else if (char === '\\' || char === '{' || char === '}') {
      out += `\\${char}`
    } else if (code > 127) {
      // RTF \uN expects signed 16-bit code units
      const units = char.length > 2 ? Array.from(char) : [char]
      for (const unit of units) {
        const cp = unit.codePointAt(0) ?? 0
        const signed = cp > 32767 ? cp - 65536 : cp
        out += `\\u${signed}?`
      }
    } else {
      out += char
    }
  }
  return out
}

function hexFromDataUrl(dataUrl: string): string {
  const base64 = dataUrl.split(',')[1] ?? ''
  try {
    const binary = atob(base64)
    let hex = ''
    for (let i = 0; i < binary.length; i++) {
      hex += binary.charCodeAt(i).toString(16).padStart(2, '0')
    }
    return hex
  } catch {
    return ''
  }
}

function renderInline(node: RtfNode): string {
  if (node.type === 'hardBreak') return '\\line '
  if (node.type === 'text') {
    let prefix = ''
    let suffix = ''
    const marks = node.marks ?? []
    if (marks.some((mark) => mark.type === 'bold')) prefix += '\\b ', suffix = '\\b0 ' + suffix
    if (marks.some((mark) => mark.type === 'italic')) prefix += '\\i ', suffix = '\\i0 ' + suffix
    if (marks.some((mark) => mark.type === 'underline')) prefix += '\\ul ', suffix = '\\ulnone ' + suffix
    if (marks.some((mark) => mark.type === 'strike')) prefix += '\\strike ', suffix = '\\strike0 ' + suffix
    if (marks.some((mark) => mark.type === 'superscript')) prefix += '\\super ', suffix = '\\nosupersub ' + suffix
    if (marks.some((mark) => mark.type === 'subscript')) prefix += '\\sub ', suffix = '\\nosupersub ' + suffix
    const fontSize = marks.find((mark) => mark.type === 'textStyle')?.attrs?.fontSize
    if (fontSize) {
      const pt = Number.parseFloat(String(fontSize))
      if (Number.isFinite(pt)) prefix += `\\fs${Math.round(pt * 2)} `
    }
    return `${prefix}${rtfUnicode(node.text ?? '')}${suffix}`
  }
  if (node.type === 'image') {
    const src = String(node.attrs?.src ?? '')
    if (!src.startsWith('data:image')) return ''
    const hex = hexFromDataUrl(src)
    if (!hex) return ''
    const isJpeg = src.startsWith('data:image/jpeg')
    const width = Number(node.attrs?.width ?? 320)
    const height = Number(node.attrs?.height ?? 200)
    return `{\\pict\\${isJpeg ? 'jpegblip' : 'pngblip'}\\picw${width}\\pich${height}\\picwgoal${Math.round(width * 15)}\\pichgoal${Math.round(
      height * 15,
    )} ${hex}}`
  }
  if (node.content) return node.content.map(renderInline).join('')
  return ''
}

function inlineContent(node: RtfNode): string {
  return (node.content ?? [])
    .map((child) => (child.type === 'paragraph' || child.type === 'heading' ? renderInline(child) : renderInline(child)))
    .join('\\line ')
}

function renderBlocks(nodes: RtfNode[], depth = 0, counter = { value: 0 }): string {
  let out = ''
  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
      case 'heading': {
        const level = Number(node.attrs?.level ?? 0)
        const size = level === 1 ? 40 : level === 2 ? 32 : level === 3 ? 28 : 28
        const align = String(node.attrs?.textAlign ?? 'left')
        const alignCode = align === 'center' ? '\\qc' : align === 'right' ? '\\qr' : align === 'justify' ? '\\qj' : '\\ql'
        out += `\\pard${alignCode}\\f1\\fs${size}${level ? '\\b ' : ''}${renderInline(node)}${
          level ? '\\b0' : ''
        }\\par\n`
        break
      }
      case 'bulletList':
      case 'orderedList': {
        counter.value = 0
        for (const item of node.content ?? []) {
          counter.value += 1
          const prefix = node.type === 'orderedList' ? `${counter.value}. ` : '\\u8226?  '
          out += `\\pard\\ql\\f1\\fs28\\li${540 + depth * 360}\\fi-300 ${prefix}${inlineContent(item)}\\par\n`
          const nested = (item.content ?? []).filter(
            (child) => child.type === 'bulletList' || child.type === 'orderedList',
          )
          if (nested.length) out += renderBlocks(nested, depth + 1, { value: 0 })
        }
        break
      }
      case 'blockquote': {
        out += `\\pard\\ql\\li720\\ri360\\f1\\fs28\\i ${inlineContent(node)}\\i0\\par\n`
        break
      }
      case 'codeBlock': {
        out += `\\pard\\ql\\f1\\fs24 ${rtfUnicode(node.content?.map((c) => c.text ?? '').join('\n') ?? '')}\\par\n`
        break
      }
      case 'horizontalRule':
        out += '\\pard\\brdrb\\brdrs\\brdrw10\\brsp20 \\par\n'
        break
      case 'pageBreak':
        out += '\\page\n'
        break
      case 'table': {
        const rows = node.content ?? []
        for (const row of rows) {
          const cells = row.content ?? []
          const cellWidth = Math.floor(9000 / Math.max(1, cells.length))
          out += '\\trowd\\trgaph108\\trleft-108'
          cells.forEach((_, index) => {
            out += `\\cellx${cellWidth * (index + 1)}`
          })
          out += '\n'
          for (const cell of cells) {
            out += `\\pard\\intbl\\f1\\fs28 ${inlineContent(cell)}\\cell\n`
          }
          out += '\\row\n'
        }
        break
      }
      default:
        if (node.content) out += renderBlocks(node.content, depth, counter)
    }
  }
  return out
}

export function buildRtf(context: ExportContext): string {
  const body = renderBlocks((context.json.content as RtfNode[]) ?? [])
  return `{\\rtf1\\ansi\\ansicpg1252\\deff1\\uc1
{\\fonttbl{\\f0\\fnil\\fcharset0 Segoe UI;}{\\f1\\fnil\\fcharset0 Noto Sans Kannada;}{\\f2\\fnil\\fcharset0 Nirmala UI;}}
{\\colortbl;\\red0\\green0\\blue0;\\red15\\green102\\blue95;}
\\viewkind4\\pard\\f1\\fs28
\\b ${rtfUnicode(context.title)}\\b0\\par
\\par
${body}
\\par
}`
}
