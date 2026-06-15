// macro レンダラ: ModuleDoc → モジュールマップSVG。
// 色=深度（indent=深0で一律 / heatmap=その型の配下最深）/ 大きさ=重み / 配置=円パッキング / 線=参照。
// 深度色は currentColor＋dcクラス＋data-do/data-dm で持ち、explorer から実行時に再着色できる。
// layoutModule(計算) と drawMapInner(描画) を分離。

import type { ColorMode, ModuleDoc, ModuleType } from './ir.ts'
import { LIGHT, depthColor } from './vocabulary.ts'
import { containerOutline } from './shapes.ts'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
const SANS = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif'
const dcol = (d: number) => depthColor(LIGHT, d)

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export interface MapNode extends ModuleType {
  X: number
  Y: number
  R: number
}

export interface MapLayout {
  nodes: MapNode[]
  ring: { cx: number; cy: number; r: number }
  vbw: number
  vbh: number
}

interface Raw extends ModuleType {
  x: number
  y: number
  r: number
}

function pack(nodes: Raw[], gap: number): void {
  nodes.sort((a, b) => b.r - a.r)
  const placed: Raw[] = []
  for (const nd of nodes) {
    if (placed.length === 0) {
      nd.x = 0
      nd.y = 0
      placed.push(nd)
      continue
    }
    let ok = false
    for (let i = 1; i < 6000 && !ok; i++) {
      const ang = i * 0.45
      const rad = Math.sqrt(i) * 6
      const x = Math.cos(ang) * rad
      const y = Math.sin(ang) * rad
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + nd.r + gap)) {
        nd.x = x
        nd.y = y
        ok = true
      }
    }
    placed.push(nd)
  }
}

export function layoutModule(mod: ModuleDoc): MapLayout {
  const raw: Raw[] = Object.values(mod.types).map((t) => ({ ...t, x: 0, y: 0, r: 16 + t.weight * 5 }))
  pack(raw, 10)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of raw) {
    minX = Math.min(minX, n.x - n.r)
    minY = Math.min(minY, n.y - n.r)
    maxX = Math.max(maxX, n.x + n.r)
    maxY = Math.max(maxY, n.y + n.r)
  }
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)

  const AX = 40
  const AY = 48
  const AW = 380
  const AH = 280
  const scale = Math.min(AW / w, AH / h, 1.5)
  const offX = AX + (AW - w * scale) / 2 - minX * scale
  const offY = AY + (AH - h * scale) / 2 - minY * scale

  const nodes: MapNode[] = raw.map((n) => ({ ...n, X: n.x * scale + offX, Y: n.y * scale + offY, R: n.r * scale }))

  const ringCX = ((minX + maxX) / 2) * scale + offX
  const ringCY = ((minY + maxY) / 2) * scale + offY
  let ringR = 0
  for (const n of nodes) ringR = Math.max(ringR, Math.hypot(n.X - ringCX, n.Y - ringCY) + n.R)
  ringR += 12

  const vbw = AX + AW + 40
  const vbh = AY + AH + 46
  return { nodes, ring: { cx: ringCX, cy: ringCY, r: ringR }, vbw, vbh }
}

export interface DrawMapOptions {
  clickable?: boolean
  colorMode?: ColorMode
}

// 内側マークアップ（外周＋エッジ＋ノード＋深度凡例）。色は currentColor、深度は data 属性。
export function drawMapInner(layout: MapLayout, mod: ModuleDoc, opts: DrawMapOptions = {}): string {
  const mode = opts.colorMode ?? 'heatmap'
  const idTo = new Map(layout.nodes.map((n) => [n.id, n]))
  const out: string[] = []
  out.push(
    `<circle cx="${layout.ring.cx}" cy="${layout.ring.cy}" r="${layout.ring.r}" fill="#f8fafc" stroke="#e5e7eb" stroke-width="1.4" stroke-dasharray="3 4"/>`,
  )
  for (const e of mod.edges) {
    const a = idTo.get(e.from)
    const b = idTo.get(e.to)
    if (!a || !b) continue
    out.push(`<line x1="${a.X}" y1="${a.Y}" x2="${b.X}" y2="${b.Y}" stroke="#c7ccd2" stroke-width="1" opacity="0.8"/>`)
  }
  for (const n of layout.nodes) {
    const initColor = dcol(mode === 'heatmap' ? n.maxDepth : 0)
    const open = opts.clickable
      ? `<g class="mapnode" data-type="${esc(n.id)}" style="cursor:pointer"><title>${esc(n.name)}（クリックでズーム）</title>`
      : '<g>'
    const bw = n.R * 1.3
    const inner =
      n.shape === 'enum'
        ? `<circle cx="${n.X - 7}" cy="${n.Y}" r="2.6" fill="currentColor"/><circle cx="${n.X}" cy="${n.Y}" r="2.6" fill="currentColor"/><circle cx="${n.X + 7}" cy="${n.Y}" r="2.6" fill="currentColor"/>`
        : `<g transform="translate(${n.X - bw / 2},${n.Y - bw / 2})">${containerOutline(n.shape, bw, bw)}</g>`
    out.push(
      `${open}<g class="dc" data-do="0" data-dm="${n.maxDepth}" style="color:${initColor}">` +
        `<circle cx="${n.X}" cy="${n.Y}" r="${n.R}" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.2"/>` +
        inner +
        `</g>` +
        `<text x="${n.X}" y="${n.Y + n.R + 13}" text-anchor="middle" font-size="11" fill="#1f2937" font-family="${MONO}">${esc(n.name)}</text></g>`,
    )
  }
  // 深度凡例
  const maxUsed = Math.min(3, Math.max(0, ...layout.nodes.map((n) => n.maxDepth)))
  const ly = layout.vbh - 16
  let lx = 40
  out.push(`<text x="${lx}" y="${ly}" font-size="11" fill="#6b7280">色＝深度</text>`)
  lx += 64
  for (let d = 0; d <= maxUsed; d++) {
    out.push(`<circle cx="${lx + 6}" cy="${ly - 4}" r="6" fill="${dcol(d)}" fill-opacity="0.16" stroke="${dcol(d)}" stroke-width="1.4"/>`)
    out.push(`<text x="${lx + 18}" y="${ly}" font-size="11" fill="#4b5563">深${d}</text>`)
    lx += 64
  }
  return out.join('\n')
}

export interface ModuleMapOptions {
  title?: string
  colorMode?: ColorMode
}

export function renderModuleMap(mod: ModuleDoc, opts: ModuleMapOptions = {}): string {
  const title = opts.title ?? 'モジュールマップ（色＝深度 / 大きさ＝重み / 線＝参照）'
  const layout = layoutModule(mod)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.vbw} ${layout.vbh}" width="100%" font-family="${SANS}">`,
    `<rect x="0.5" y="0.5" width="${layout.vbw - 1}" height="${layout.vbh - 1}" rx="12" fill="#ffffff" stroke="#e5e7eb"/>`,
    `<text x="${layout.vbw / 2}" y="28" text-anchor="middle" font-size="13" font-weight="500" fill="#111827">${esc(title)}</text>`,
    drawMapInner(layout, mod, { colorMode: opts.colorMode ?? 'heatmap' }),
    '</svg>',
  ].join('\n')
}
