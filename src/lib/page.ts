import { PAGE_DIMENSIONS, type PageSettings } from '@/types/document'

export const PX_PER_MM = 96 / 25.4
export const CM_TO_PX = 96 / 2.54

export interface PageMetrics {
  pageWidth: number
  pageHeight: number
  contentWidth: number
  contentHeight: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
}

export function getPageMetrics(settings: PageSettings): PageMetrics {
  const base = PAGE_DIMENSIONS[settings.size] ?? PAGE_DIMENSIONS.A4
  const pageWidth = settings.orientation === 'landscape' ? base.height : base.width
  const pageHeight = settings.orientation === 'landscape' ? base.width : base.height
  const paddingTop = settings.margins.top
  const paddingBottom = settings.margins.bottom
  const paddingLeft = settings.margins.left
  const paddingRight = settings.margins.right
  return {
    pageWidth,
    pageHeight,
    contentWidth: Math.max(120, pageWidth - paddingLeft - paddingRight),
    contentHeight: Math.max(120, pageHeight - paddingTop - paddingBottom),
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
  }
}

/** Pixel dimensions of the page's physical size, used as a print fallback. */
export function pageSizeMm(settings: PageSettings): { width: number; height: number } {
  const map = {
    A4: { width: 210, height: 297 },
    A5: { width: 148, height: 210 },
    Letter: { width: 215.9, height: 279.4 },
    Legal: { width: 215.9, height: 355.6 },
  } satisfies Record<string, { width: number; height: number }>
  const size = map[settings.size] ?? map.A4
  return settings.orientation === 'landscape'
    ? { width: size.height, height: size.width }
    : size
}

export function pxToMm(px: number): number {
  return px / PX_PER_MM
}

export function twipFromPx(px: number): number {
  return Math.round(px * 15)
}

export function fontFamilyStack(font: string): string {
  const quoted = `'${font}'`
  return `${quoted}, 'Noto Sans Kannada', 'Nirmala UI', 'Tunga', sans-serif`
}
