import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resourcesDir = join(__dirname, '..', 'resources')

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

// ─── SVG — vector source of truth ─────────────────────────
const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <text x="256" y="300" font-family="Arial, sans-serif" font-size="240" font-weight="bold" fill="white" text-anchor="middle">B</text>
  <circle cx="380" cy="140" r="48" fill="#60A5FA"/>
</svg>`

// ─── Raster helpers ───────────────────────────────────────
const clamp = v => Math.max(0, Math.min(255, v))
const lerp = (a, b, t) => a + (b - a) * t

function sdBox(px, py, cx, cy, w, h) {
  const dx = Math.abs(px - cx) - w / 2
  const dy = Math.abs(py - cy) - h / 2
  return Math.max(dx, dy)
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r
}

function sdRoundedRect(px, py, cx, cy, w, h, r) {
  const hw = w / 2, hh = h / 2
  const rx = Math.abs(px - cx), ry = Math.abs(py - cy)
  if (rx > hw + r || ry > hh + r) return Math.max(rx - hw, ry - hh)
  if (rx <= hw && ry <= hh) return -Math.min(hw - rx, hh - ry)
  return Math.hypot(Math.max(rx - hw, 0), Math.max(ry - hh, 0)) - r
}

// ─── 256×256 RGBA pixel generation ────────────────────────
const SIZE = 256
const CORNER_R = 48
const data = Buffer.alloc(SIZE * SIZE * 4, 0)

const BG1 = [59, 130, 246, 255]
const BG2 = [29, 78, 216, 255]
const ACCENT = [96, 165, 250, 255]

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const px = x / SIZE
    const py = y / SIZE
    const idx = (y * SIZE + x) * 4

    const bgDist = sdRoundedRect(x, y, SIZE / 2, SIZE / 2, SIZE * 0.92, SIZE * 0.92, CORNER_R)
    const bgAlpha = clamp(Math.round((1 - bgDist * 4) * 255))
    if (bgAlpha <= 0) { data[idx + 3] = 0; continue }

    const grad = (px + py) / 2
    let rCol = lerp(BG1[0], BG2[0], grad)
    let gCol = lerp(BG1[1], BG2[1], grad)
    let bCol = lerp(BG1[2], BG2[2], grad)

    // B letter — SDF union of bars and lobes
    const leftBar = sdBox(x, y, SIZE * 0.36, SIZE * 0.5, SIZE * 0.08, SIZE * 0.46)
    const topBar = sdBox(x, y, SIZE * 0.51, SIZE * 0.19, SIZE * 0.22, SIZE * 0.06)
    const midBar = sdBox(x, y, SIZE * 0.49, SIZE * 0.5, SIZE * 0.18, SIZE * 0.06)
    const botBar = sdBox(x, y, SIZE * 0.51, SIZE * 0.81, SIZE * 0.22, SIZE * 0.06)

    const lobeCX = SIZE * 0.58
    const topLobe = sdCircle(x, y, lobeCX, SIZE * 0.19, SIZE * 0.10)
    const botLobe = sdCircle(x, y, lobeCX, SIZE * 0.81, SIZE * 0.10)
    const clip = SIZE * 0.38 - x
    const bDist = Math.min(leftBar, topBar, midBar, botBar, Math.max(topLobe, clip), Math.max(botLobe, clip))

    if (bDist < 0) { rCol = 255; gCol = 255; bCol = 255 }

    // Accent dot top-right
    const aDist = sdCircle(x, y, SIZE * 0.78, SIZE * 0.22, SIZE * 0.06)
    if (aDist < 0) {
      const t = clamp(1 + aDist * 3)
      rCol = lerp(rCol, ACCENT[0], t)
      gCol = lerp(gCol, ACCENT[1], t)
      bCol = lerp(bCol, ACCENT[2], t)
    }

    data[idx] = clamp(Math.round(rCol))
    data[idx + 1] = clamp(Math.round(gCol))
    data[idx + 2] = clamp(Math.round(bCol))
    data[idx + 3] = bgAlpha
  }
}

// ─── PNG encoder (pure Node.js, no dependencies) ──────────
function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let j = 0; j < 8; j++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1
  }
  return (c ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, payload) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(payload.length)
  const crcBuf = Buffer.concat([t, payload])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcBuf))
  return Buffer.concat([len, t, payload, crc])
}

function createPNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let r = 0; r < h; r++) {
    raw[r * (1 + w * 4)] = 0
    rgba.copy(raw, r * (1 + w * 4) + 1, r * w * 4, (r + 1) * w * 4)
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const pngData = createPNG(SIZE, SIZE, data)

// ─── ICO wrapper ──────────────────────────────────────────
function createICO(png, sz) {
  const off = 6 + 16
  const hdr = Buffer.alloc(off)
  hdr.writeUInt16LE(0, 0)           // reserved
  hdr.writeUInt16LE(1, 2)           // type = ICO
  hdr.writeUInt16LE(1, 4)           // count
  const ew = sz >= 256 ? 0 : sz
  hdr.writeUInt8(ew, 6)             // width
  hdr.writeUInt8(ew, 7)             // height
  hdr.writeUInt8(0, 8)              // colors
  hdr.writeUInt8(0, 9)              // reserved
  hdr.writeUInt16LE(1, 10)          // planes
  hdr.writeUInt16LE(32, 12)         // bpp
  hdr.writeUInt32LE(png.length, 14) // image size
  hdr.writeUInt32LE(off, 18)        // image offset
  return Buffer.concat([hdr, png])
}

// ─── ICNS wrapper ─────────────────────────────────────────
function createICNS(png) {
  const iconType = 'ic07'
  const entryLen = 8 + png.length
  const totalLen = 8 + entryLen
  const buf = Buffer.alloc(totalLen)
  buf.write('icns', 0, 4, 'ascii')
  buf.writeUInt32BE(totalLen, 4)
  buf.write(iconType, 8, 4, 'ascii')
  buf.writeUInt32BE(entryLen, 12)
  png.copy(buf, 16)
  return buf
}

// ─── Emit files ───────────────────────────────────────────
ensureDir(resourcesDir)

writeFileSync(join(resourcesDir, 'icon.svg'), SVG_ICON)
console.log(`✓ icon.svg  — ${join(resourcesDir, 'icon.svg')}`)

writeFileSync(join(resourcesDir, 'icon.png'), pngData)
console.log(`✓ icon.png  — ${pngData.length} bytes (${SIZE}×${SIZE} PNG)`)

writeFileSync(join(resourcesDir, 'icon.ico'), createICO(pngData, SIZE))
console.log(`✓ icon.ico  — ${join(resourcesDir, 'icon.ico')} (valid ICO + embedded PNG)`)

writeFileSync(join(resourcesDir, 'icon.icns'), createICNS(pngData))
console.log(`✓ icon.icns — ${join(resourcesDir, 'icon.icns')} (valid ICNS, ic07 256×256)`)

console.log('\nDone — all 4 icon assets created in resources/')
