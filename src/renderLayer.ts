// 試作: セマンティックズーム「層(layer)」レンダラ。
// 形＝型の器（interface はパズルのピース）。器はズームをまたいで保たれ、
// 層が進むと中身が開示される:
//   層1: 形＋名前
//   層2: 形＋構成アイコン（ラベル無し・境界が薄い）
//   層3: 形＋アイコン＋ラベル
// ※「層」は深度(=色)とは別軸。この試作は層の仕組みの確認用で、深度色は載せていない。
// ※ glyph は将来 renderSvg と共有予定（今は試作用にローカル定義）。

import type { Doc, TypeIR } from './ir.ts'

const C = {
  bg: '#ffffff',
  border: '#e5e7eb',
  ink: '#111827',
  sub: '#6b7280',
  faint: '#b6bdc6', // 薄い境界（層2/3）
  icon: '#4b5563',
  cap: '#6b7280',
  capFaint: '#9aa1a9',
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// interface/object のパズルピース輪郭（上と左にタブが出る）。タブは d の余白内に収まる。
function puzzlePath(W: number, H: number, d = 18): string {
  const tab = d - 2
  const txa = d + 0.34 * (W - d)
  const txb = d + 0.66 * (W - d)
  const tya = d + 0.34 * (H - d)
  const tyb = d + 0.66 * (H - d)
  return [
    `M ${d} ${d}`,
    `L ${txa} ${d}`,
    `C ${txa} ${d - tab} ${txb} ${d - tab} ${txb} ${d}`,
    `L ${W} ${d}`,
    `L ${W} ${H}`,
    `L ${d} ${H}`,
    `L ${d} ${tyb}`,
    `C ${d - tab} ${tyb} ${d - tab} ${tya} ${d} ${tya}`,
    `Z`,
  ].join(' ')
}

// 行頭アイコンの種別（プリミティブ中心。試作用の最小版）
function leadingKind(t: TypeIR, defs: Record<string, TypeIR>): string {
  switch (t.kind) {
    case 'primitive':
      return t.name === 'string' || t.name === 'number' || t.name === 'boolean' ? t.name : 'default'
    case 'literal':
      return t.base
    case 'object':
    case 'class':
      return 'object'
    case 'array':
    case 'tuple':
      return 'array'
    case 'function':
      return 'function'
    case 'ref': {
      const d = defs[t.id]
      return d ? leadingKind(d, defs) : 'default'
    }
    default:
      return 'default'
  }
}

// 16px相当の小アイコンを (cx,cy) 中心に描く
function glyphAt(kind: string, cx: number, cy: number, c: string): string {
  const s = `stroke="${c}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"`
  const f = `fill="${c}"`
  switch (kind) {
    case 'string':
      return `<path d="M${cx - 6} ${cy - 5} l2.8 0 l-1 3.6 l-1.8 0 z" ${f}/><path d="M${cx - 1} ${cy - 5} l2.8 0 l-1 3.6 l-1.8 0 z" ${f}/>`
    case 'number':
      return `<path d="M${cx - 1} ${cy - 6} L${cx - 3} ${cy + 6} M${cx + 4} ${cy - 6} L${cx + 2} ${cy + 6} M${cx - 6} ${cy - 2} L${cx + 6} ${cy - 2} M${cx - 7} ${cy + 2} L${cx + 5} ${cy + 2}" ${s}/>`
    case 'boolean':
      return `<rect x="${cx - 7}" y="${cy - 3.5}" width="15" height="7" rx="3.5" ${s}/><circle cx="${cx + 4.5}" cy="${cy}" r="2.1" ${f}/>`
    case 'object':
      return `<rect x="${cx - 7}" y="${cy - 6}" width="14" height="12" rx="2.5" ${s}/><path d="M${cx - 4} ${cy - 2} L${cx + 4} ${cy - 2} M${cx - 4} ${cy + 2} L${cx + 1} ${cy + 2}" ${s}/>`
    case 'array':
      return `<path d="M${cx - 4} ${cy - 6} L${cx - 7} ${cy - 6} L${cx - 7} ${cy + 6} L${cx - 4} ${cy + 6}" ${s}/><path d="M${cx + 4} ${cy - 6} L${cx + 7} ${cy - 6} L${cx + 7} ${cy + 6} L${cx + 4} ${cy + 6}" ${s}/><circle cx="${cx - 1.5}" cy="${cy}" r="0.9" ${f}/><circle cx="${cx + 1.5}" cy="${cy}" r="0.9" ${f}/>`
    case 'function':
      return `<path d="M${cx - 6} ${cy - 5} l3 5 l-3 5" ${s}/><path d="M${cx - 1} ${cy - 5} l3 5 l-3 5" ${s}/>`
    default:
      return `<rect x="${cx - 7}" y="${cy - 6}" width="14" height="12" rx="2.5" ${s}/><path d="M${cx - 3} ${cy - 2} l-2 2 l2 2 M${cx + 3} ${cy - 2} l2 2 l-2 2" ${s}/>`
  }
}

export type Layer = 1 | 2 | 3

function resolveRoot(doc: Doc): { name: string; members: { name: string; type: TypeIR }[] } {
  let name = '(anonymous)'
  let target: TypeIR = doc.root
  if (doc.root.kind === 'ref') {
    name = doc.root.name
    target = doc.defs[doc.root.id]
  }
  if (target && target.kind === 'class') name = target.name
  const members = target && (target.kind === 'object' || target.kind === 'class') ? target.members : []
  return { name, members }
}

const W = 170
const H = 156
const D = 18

// 1つのピースを (ox,oy) に layer で描く
function drawPiece(doc: Doc, ox: number, oy: number, layer: Layer): string {
  const { name, members } = resolveRoot(doc)
  const defs = doc.defs
  const cx = (D + W) / 2
  const cy = (D + H) / 2
  const out: string[] = [`<g transform="translate(${ox},${oy})">`]

  // 器（境界は層1=実線、層2/3=薄い破線）
  const boundary =
    layer === 1
      ? `stroke="${C.ink}" stroke-width="2"`
      : `stroke="${C.faint}" stroke-width="1.6" stroke-dasharray="5 4"`
  out.push(`<path d="${puzzlePath(W, H)}" fill="none" ${boundary} stroke-linejoin="round"/>`)

  if (layer === 1) {
    out.push(
      `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="15" fill="${C.ink}" font-family="${MONO}">${esc(name)}</text>`,
    )
  } else if (layer === 2) {
    // 構成アイコンを器の中にクラスタ（ラベル無し）
    const n = members.length
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)))
    const rows = Math.ceil(n / cols)
    const cw = 30
    const ch = 30
    const sx = cx - (cols * cw) / 2 + cw / 2
    const sy = cy - (rows * ch) / 2 + ch / 2
    members.forEach((m, i) => {
      const r = Math.floor(i / cols)
      const c = i % cols
      out.push(glyphAt(leadingKind(m.type, defs), sx + c * cw, sy + r * ch, C.icon))
    })
  } else {
    // アイコン＋ラベルを縦に積む
    const n = members.length
    const rh = 28
    const sy = cy - (n * rh) / 2 + rh / 2
    members.forEach((m, i) => {
      const gy = sy + i * rh
      out.push(glyphAt(leadingKind(m.type, defs), cx - 38, gy, C.icon))
      out.push(
        `<text x="${cx - 20}" y="${gy + 4}" font-size="13" fill="${C.ink}" font-family="${MONO}">${esc(m.name)}</text>`,
      )
    })
  }

  out.push('</g>')
  return out.join('\n')
}

// 単一ピースのSVG
export function renderPiece(doc: Doc, opts: { layer?: Layer } = {}): string {
  const layer = opts.layer ?? 3
  const vbw = W + 24
  const vbh = H + 24
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbw} ${vbh}" width="${vbw}" height="${vbh}" font-family="ui-sans-serif, system-ui, sans-serif">`,
    `<rect x="0.5" y="0.5" width="${vbw - 1}" height="${vbh - 1}" rx="12" fill="${C.bg}" stroke="${C.border}"/>`,
    drawPiece(doc, 12, 12, layer),
    '</svg>',
  ].join('\n')
}

// 層1/2/3 を横に並べた試作ストリップ
export function renderLayerStrip(doc: Doc): string {
  const VBW = 680
  const oy = 58
  const VBH = oy + H + 32
  const cols = [
    { ox: 28, layer: 1 as Layer, cap: '形＋名前' },
    { ox: 254, layer: 2 as Layer, cap: '構成アイコン・境界が薄い' },
    { ox: 480, layer: 3 as Layer, cap: 'アイコン＋ラベル' },
  ]
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VBW} ${VBH}" width="100%" font-family="ui-sans-serif, system-ui, sans-serif">`,
    `<rect x="0.5" y="0.5" width="${VBW - 1}" height="${VBH - 1}" rx="12" fill="${C.bg}" stroke="${C.border}"/>`,
  ]
  for (const col of cols) {
    const cxAbs = col.ox + W / 2
    out.push(
      `<text x="${cxAbs}" y="34" text-anchor="middle" font-size="14" font-weight="500" fill="${C.cap}">第${col.layer}層</text>`,
    )
    out.push(drawPiece(doc, col.ox, oy, col.layer))
    out.push(
      `<text x="${cxAbs}" y="${oy + H + 22}" text-anchor="middle" font-size="11" fill="${C.capFaint}">${esc(col.cap)}</text>`,
    )
  }
  out.push('</svg>')
  return out.join('\n')
}
