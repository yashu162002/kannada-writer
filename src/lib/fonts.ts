export interface KannadaFont {
  name: string
  label: string
  stack: string
  group: 'Bundled' | 'System' | 'Installed (optional)'
  weight?: number
  note?: string
}

const fallback = "'Noto Sans Kannada', 'Nirmala UI', 'Tunga', sans-serif"

/**
 * Fonts that are actually available: seven Kannada families are bundled locally
 * in /public/fonts (SIL Open Font License via Google Fonts). System fonts are
 * used only when present on the machine, with a guaranteed Noto fallback.
 */
export const KANNADA_FONTS: KannadaFont[] = [
  {
    name: 'Noto Sans Kannada',
    label: 'Noto Sans Kannada',
    stack: `'Noto Sans Kannada', ${fallback}`,
    group: 'Bundled',
  },
  {
    name: 'Noto Serif Kannada',
    label: 'Noto Serif Kannada',
    stack: `'Noto Serif Kannada', ${fallback}`,
    group: 'Bundled',
  },
  {
    name: 'Noto Serif Kannada ExtraBold',
    label: 'Noto Serif Kannada ExtraBold',
    stack: `'Noto Serif Kannada', ${fallback}`,
    group: 'Bundled',
    weight: 800,
    note: 'ExtraBold weight',
  },
  {
    name: 'Baloo Tamma 2',
    label: 'Baloo Tamma 2',
    stack: `'Baloo Tamma 2', ${fallback}`,
    group: 'Bundled',
  },
  {
    name: 'Anek Kannada',
    label: 'Anek Kannada',
    stack: `'Anek Kannada', ${fallback}`,
    group: 'Bundled',
  },
  {
    name: 'Tiro Kannada',
    label: 'Tiro Kannada',
    stack: `'Tiro Kannada', ${fallback}`,
    group: 'Bundled',
  },
  {
    name: 'Hind Mysuru',
    label: 'Hind Mysuru',
    stack: `'Hind Mysuru', ${fallback}`,
    group: 'Bundled',
  },
  {
    name: 'Ranga',
    label: 'Ranga',
    stack: `'Ranga', ${fallback}`,
    group: 'Bundled',
  },
  {
    name: 'Noto Sans Kannada UI',
    label: 'Noto Sans Kannada UI',
    stack: `'Noto Sans Kannada UI', 'Noto Sans Kannada', ${fallback}`,
    group: 'System',
    note: 'Windows system font',
  },
  {
    name: 'Nirmala UI',
    label: 'Nirmala UI',
    stack: `'Nirmala UI', ${fallback}`,
    group: 'System',
    note: 'Windows system font',
  },
  {
    name: 'Kedage',
    label: 'Kedage',
    stack: `'Kedage', ${fallback}`,
    group: 'Installed (optional)',
    note: 'Free font from Kannada University; used if installed',
  },
  {
    name: 'Mallige',
    label: 'Mallige',
    stack: `'Mallige', ${fallback}`,
    group: 'Installed (optional)',
    note: 'Free font from Kannada University; used if installed',
  },
  {
    name: 'Lohit Kannada',
    label: 'Lohit Kannada',
    stack: `'Lohit Kannada', ${fallback}`,
    group: 'Installed (optional)',
    note: 'Used when installed on the system',
  },
  {
    name: 'Segoe UI',
    label: 'Segoe UI (Latin)',
    stack: `'Segoe UI', ${fallback}`,
    group: 'System',
    note: 'Best for mixed English + Kannada',
  },
]

export const DEFAULT_KANNADA_FONT = 'Noto Sans Kannada'

export function getFontStack(name: string): string {
  return KANNADA_FONTS.find((font) => font.name === name)?.stack ?? `'${name}', ${fallback}`
}
