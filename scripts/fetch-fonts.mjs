/**
 * One-time asset script: download Kannada webfonts from Google Fonts (OFL) and
 * generate a locally hosted stylesheet so the editor renders Kannada offline.
 * Run: node scripts/fetch-fonts.mjs
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const OUT_DIR = path.resolve('public/fonts')
const CSS_OUT = path.resolve('public/fonts/kannada-fonts.css')

const families = [
  'Noto+Sans+Kannada:wght@400;500;600;700',
  'Noto+Serif+Kannada:wght@400;500;600;700;800',
  'Baloo+Tamma+2:wght@400;500;600;700',
  'Anek+Kannada:wght@400;500;600;700',
  'Tiro+Kannada:ital@0;1',
  'Hind+Mysuru:wght@400;500;600;700',
  'Ranga:wght@400;700',
]

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

await fs.mkdir(OUT_DIR, { recursive: true })

const localCss = []
const downloaded = new Set()

for (const family of families) {
  const url = `https://fonts.googleapis.com/css2?family=${family}&display=swap`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) {
    console.warn('CSS fetch failed', family, res.status)
    continue
  }
  let css = await res.text()
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]))]
  for (const fontUrl of urls) {
    const hash = crypto.createHash('sha1').update(fontUrl).digest('hex').slice(0, 16)
    const name = `${hash}.woff2`
    const target = path.join(OUT_DIR, name)
    if (!downloaded.has(name)) {
      try {
        await fs.access(target)
      } catch {
        const fontRes = await fetch(fontUrl, { headers: { 'User-Agent': UA } })
        if (!fontRes.ok) {
          console.warn('font fetch failed', fontUrl, fontRes.status)
          continue
        }
        const buf = Buffer.from(await fontRes.arrayBuffer())
        await fs.writeFile(target, buf)
        console.log('saved', name, `${Math.round(buf.length / 1024)} KB`, family)
      }
      downloaded.add(name)
    }
    css = css.split(fontUrl).join(`/fonts/${name}`)
  }
  localCss.push(`/* ${family.replace(/\+/g, ' ')} */\n${css.trim()}\n`)
}

await fs.writeFile(CSS_OUT, `${localCss.join('\n')}\n`, 'utf8')
console.log(`wrote ${CSS_OUT} with ${downloaded.size} font files`)
