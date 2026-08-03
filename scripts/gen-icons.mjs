import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const repo = '/home/user/crispy-octo-garbanzo'
const svg = readFileSync(resolve(repo, 'public/favicon.svg'), 'utf8')
// maskable: same mark but with extra safe-zone padding (scale down inside the tile)
const maskableSvg = svg.replace(
  '<rect width="512" height="512" rx="112" fill="#0a0a0a"/>',
  '<rect width="512" height="512" rx="0" fill="#0a0a0a"/><g transform="translate(76.8,76.8) scale(0.7)">',
).replace('</svg>', '</g></svg>')

mkdirSync(resolve(repo, 'public/icons'), { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage()

async function shot(svgText, size, out) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<style>*{margin:0}body{background:transparent}</style><img src="data:image/svg+xml;base64,${Buffer.from(svgText).toString('base64')}" width="${size}" height="${size}">`,
  )
  await page.screenshot({ path: resolve(repo, out), omitBackground: true })
  console.log('wrote', out)
}

await shot(svg, 192, 'public/icons/icon-192.png')
await shot(svg, 512, 'public/icons/icon-512.png')
await shot(maskableSvg, 512, 'public/icons/icon-maskable-512.png')
// apple-touch-icon must be opaque
const opaque = svg.replace('rx="112"', 'rx="0"')
await shot(opaque, 180, 'public/icons/apple-touch-icon.png')

await browser.close()
