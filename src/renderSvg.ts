// 静的SVGレンダラ（第一弾）: Doc → L1 サマリーカードのSVG文字列。
// - 自己完結（独自の背景パネル＋埋め込み色）なので、ドキュメント/READMEにそのまま貼れる。
// - グリフは v0 のプレースホルダ。意味（チャネル割り当て）は確定、絵柄は今後磨く。

import type { Doc, Member, TypeIR } from './ir.ts'
import { LIGHT, depthColor, OPAQUE_GLYPH } from './vocabulary.ts'
import type { Palette } from './vocabulary.ts'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface TextOpts {
  size?: number
  color?: string
  anchor?: 'start' | 'middle' | 'end'
  weight?: number
  family?: string
}

function text(x: number, y: number, str: string, o: TextOpts = {}): string {
  const a = [
    `x="${x}"`,
    `y="${y}"`,
    `font-size="${o.size ?? 12}"`,
    `fill="${o.color ?? '#111'}"`,
  ]
  if (o.anchor) a.push(`text-anchor="${o.anchor}"`)
  if (o.weight) a.push(`font-weight="${o.weight}"`)
  if (o.family) a.push(`font-family="${o.family}"`)
  return `<text ${a.join(' ')}>${esc(str)}</text>`
}

// ── 1行の型を一行テキストに（L1向けの圧縮表記）──
export function typeLabel(t: TypeIR): string {
  switch (t.kind) {
    case 'primitive':
      return t.name
    case 'literal':
      return t.base === 'string' ? `"${t.value}"` : String(t.value)
    case 'special':
      return t.name
    case 'object':
      return `{ ${t.members.length} }`
    case 'array':
      return `${typeLabel(t.element)}[]`
    case 'tuple':
      return `[${t.elements.map(typeLabel).join(', ')}]`
    case 'class':
      return t.name
    case 'enum':
      return t.name
    case 'record':
      return `Record<${typeLabel(t.key)}, ${typeLabel(t.value)}>`
    case 'opaque':
      return t.args.length ? `${t.name}<${t.args.map(typeLabel).join(', ')}>` : t.name
    case 'union':
      return t.options.map(typeLabel).join(' | ')
    case 'intersection':
      return t.parts.map(typeLabel).join(' & ')
    case 'function':
      return `(${t.params
        .map((p) => `${p.rest ? '...' : ''}${p.name}${p.optional ? '?' : ''}: ${typeLabel(p.type)}`)
        .join(', ')}) => ${typeLabel(t.returns)}`
    case 'conditional':
      return `${typeLabel(t.check)} extends ${typeLabel(t.ext)} ? … : …`
    case 'mapped':
      return `{ [K in ${typeLabel(t.constraint)}]: … }`
    case 'typeParam':
      return t.name
    case 'ref':
      return t.name + (t.args && t.args.length ? `<${t.args.map(typeLabel).join(', ')}>` : '')
  }
}

// ── 行頭グリフのID（チャネル割り当ての要）──
function leadingGlyphId(t: TypeIR, defs: Record<string, TypeIR>): string {
  switch (t.kind) {
    case 'primitive':
      if (t.name === 'string' || t.name === 'number' || t.name === 'boolean') return t.name
      if (t.name === 'null' || t.name === 'undefined' || t.name === 'void') return 'null'
      return 'symbol' // symbol / bigint
    case 'literal':
      return t.base
    case 'special':
      return 'special'
    case 'object':
      return 'object'
    case 'array':
      return 'array'
    case 'tuple':
      return 'tuple'
    case 'class':
      return 'class'
    case 'enum':
      return 'enum'
    case 'record':
      return 'record'
    case 'opaque':
      return OPAQUE_GLYPH[t.name] ?? 'default'
    case 'union':
      return 'union'
    case 'intersection':
      return 'intersection'
    case 'function':
      return 'function'
    case 'conditional':
      return 'conditional'
    case 'mapped':
      return 'mapped'
    case 'typeParam':
      return 'typeParam'
    case 'ref': {
      const d = defs[t.id]
      return d ? leadingGlyphId(d, defs) : 'default'
    }
  }
}

// ── 16x16 のセル内に描くグリフ（左上 gx,gy, 色 c）──
function glyph(id: string, gx: number, gy: number, c: string): string {
  const s = `stroke="${c}" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"`
  const f = `fill="${c}"`
  switch (id) {
    case 'string': // 引用符
      return `<path d="M${gx + 4} ${gy + 4.5} l2.6 0 l-1 3.4 l-1.6 0 z" ${f}/><path d="M${gx + 8.5} ${gy + 4.5} l2.6 0 l-1 3.4 l-1.6 0 z" ${f}/>`
    case 'number': // #
      return `<path d="M${gx + 6} ${gy + 3.5} L${gx + 4.6} ${gy + 12.5} M${gx + 10} ${gy + 3.5} L${gx + 8.6} ${gy + 12.5} M${gx + 3.6} ${gy + 7} L${gx + 12.6} ${gy + 7} M${gx + 3.2} ${gy + 10} L${gx + 12.2} ${gy + 10}" ${s}/>`
    case 'boolean': // トグル
      return `<rect x="${gx + 2.5}" y="${gy + 5}" width="11" height="6.5" rx="3.25" ${s}/><circle cx="${gx + 10.3}" cy="${gy + 8.25}" r="2" ${f}/>`
    case 'null': // ∅
      return `<circle cx="${gx + 8}" cy="${gy + 8}" r="5" ${s}/><path d="M${gx + 4.5} ${gy + 11.5} L${gx + 11.5} ${gy + 4.5}" ${s}/>`
    case 'symbol': // *
      return `<path d="M${gx + 8} ${gy + 3.5} L${gx + 8} ${gy + 12.5} M${gx + 4} ${gy + 5.5} L${gx + 12} ${gy + 10.5} M${gx + 12} ${gy + 5.5} L${gx + 4} ${gy + 10.5}" ${s}/>`
    case 'object':
      return `<rect x="${gx + 2.5}" y="${gy + 3}" width="11" height="10" rx="2.5" ${s}/><path d="M${gx + 5} ${gy + 6.5} L${gx + 11} ${gy + 6.5} M${gx + 5} ${gy + 9.5} L${gx + 9} ${gy + 9.5}" ${s}/>`
    case 'array':
      return `<path d="M${gx + 5.5} ${gy + 3} L${gx + 3.5} ${gy + 3} L${gx + 3.5} ${gy + 13} L${gx + 5.5} ${gy + 13}" ${s}/><path d="M${gx + 10.5} ${gy + 3} L${gx + 12.5} ${gy + 3} L${gx + 12.5} ${gy + 13} L${gx + 10.5} ${gy + 13}" ${s}/><circle cx="${gx + 6.9}" cy="${gy + 8}" r="0.9" ${f}/><circle cx="${gx + 9.1}" cy="${gy + 8}" r="0.9" ${f}/>`
    case 'tuple':
      return `<path d="M${gx + 5} ${gy + 3} L${gx + 3.5} ${gy + 3} L${gx + 3.5} ${gy + 13} L${gx + 5} ${gy + 13}" ${s}/><path d="M${gx + 11} ${gy + 3} L${gx + 12.5} ${gy + 3} L${gx + 12.5} ${gy + 13} L${gx + 11} ${gy + 13}" ${s}/><rect x="${gx + 5.4}" y="${gy + 6.8}" width="1.7" height="2.4" ${f}/><rect x="${gx + 7.6}" y="${gy + 6.8}" width="1.7" height="2.4" ${f}/><rect x="${gx + 9.8}" y="${gy + 6.8}" width="1.7" height="2.4" ${f}/>`
    case 'class': // 六角形
      return `<path d="M${gx + 8} ${gy + 2.5} L${gx + 13.5} ${gy + 5.5} L${gx + 13.5} ${gy + 10.5} L${gx + 8} ${gy + 13.5} L${gx + 2.5} ${gy + 10.5} L${gx + 2.5} ${gy + 5.5} Z" ${s}/>`
    case 'enum':
      return `<circle cx="${gx + 4}" cy="${gy + 5}" r="1.1" ${f}/><path d="M${gx + 6.5} ${gy + 5} L${gx + 12.5} ${gy + 5}" ${s}/><circle cx="${gx + 4}" cy="${gy + 8.5}" r="1.1" ${f}/><path d="M${gx + 6.5} ${gy + 8.5} L${gx + 12.5} ${gy + 8.5}" ${s}/><circle cx="${gx + 4}" cy="${gy + 12}" r="1.1" ${f}/><path d="M${gx + 6.5} ${gy + 12} L${gx + 10.5} ${gy + 12}" ${s}/>`
    case 'record': // キー|値 グリッド
      return `<rect x="${gx + 2.5}" y="${gy + 4}" width="11" height="8" rx="1.5" ${s}/><path d="M${gx + 8} ${gy + 4} L${gx + 8} ${gy + 12} M${gx + 2.5} ${gy + 8} L${gx + 13.5} ${gy + 8}" ${s}/>`
    case 'function': // 二重シェブロン
      return `<path d="M${gx + 4} ${gy + 4} l3 4 l-3 4" ${s}/><path d="M${gx + 8.5} ${gy + 4} l3 4 l-3 4" ${s}/>`
    case 'union': // 重なる矩形
      return `<rect x="${gx + 2}" y="${gy + 4.5}" width="8" height="7" rx="2" ${s}/><rect x="${gx + 6}" y="${gy + 4.5}" width="8" height="7" rx="2" ${s}/>`
    case 'intersection': // ベン図
      return `<circle cx="${gx + 6}" cy="${gy + 8}" r="3.6" ${s}/><circle cx="${gx + 10}" cy="${gy + 8}" r="3.6" ${s}/>`
    case 'calendar': // Date
      return `<rect x="${gx + 3}" y="${gy + 4}" width="10" height="9" rx="1.5" ${s}/><path d="M${gx + 3} ${gy + 6.8} L${gx + 13} ${gy + 6.8} M${gx + 5.5} ${gy + 3} L${gx + 5.5} ${gy + 5} M${gx + 10.5} ${gy + 3} L${gx + 10.5} ${gy + 5}" ${s}/>`
    case 'promise': // 循環矢印
      return `<path d="M${gx + 12.2} ${gy + 6.4} A5 5 0 1 0 ${gx + 13} ${gy + 10}" ${s}/><path d="M${gx + 12.8} ${gy + 3.6} L${gx + 12.2} ${gy + 6.8} L${gx + 9.2} ${gy + 6}" ${s}/>`
    case 'conditional': // 分岐（ひし形）
      return `<path d="M${gx + 8} ${gy + 2.5} L${gx + 12} ${gy + 6.5} L${gx + 8} ${gy + 10.5} L${gx + 4} ${gy + 6.5} Z" ${s}/><path d="M${gx + 8} ${gy + 10.5} L${gx + 8} ${gy + 13.5}" ${s}/>`
    case 'mapped': // 反復（層）
      return `<rect x="${gx + 6}" y="${gy + 3}" width="8" height="6" rx="1.5" ${s}/><rect x="${gx + 4}" y="${gy + 5.5}" width="8" height="6" rx="1.5" ${s}/><rect x="${gx + 2}" y="${gy + 8}" width="8" height="6" rx="1.5" ${s}/>`
    case 'typeParam': // 空きスロット <◌>
      return `<path d="M${gx + 6} ${gy + 4} l-3 4 l3 4" ${s}/><path d="M${gx + 10} ${gy + 4} l3 4 l-3 4" ${s}/><circle cx="${gx + 8}" cy="${gy + 8}" r="2.2" stroke="${c}" stroke-width="1.2" fill="none" stroke-dasharray="1.6 1.6"/>`
    case 'special': // 危険（警告）
      return `<path d="M${gx + 8} ${gy + 3} L${gx + 14} ${gy + 13} L${gx + 2} ${gy + 13} Z" ${s}/><path d="M${gx + 8} ${gy + 7} L${gx + 8} ${gy + 10}" ${s}/><circle cx="${gx + 8}" cy="${gy + 11.7}" r="0.7" ${f}/>`
    default: // opaque / ref のフォールバック（<> 付きの箱）
      return `<rect x="${gx + 2.5}" y="${gy + 3.5}" width="11" height="9" rx="2" ${s}/><path d="M${gx + 6} ${gy + 6} l-2 2 l2 2 M${gx + 10} ${gy + 6} l2 2 l-2 2" ${s}/>`
  }
}

function badgeReadonly(bx: number, by: number, c: string): string {
  return (
    `<rect x="${bx}" y="${by + 6.5}" width="8" height="6" rx="1.3" fill="none" stroke="${c}" stroke-width="1.2"/>` +
    `<path d="M${bx + 1.7} ${by + 6.5} v-1.6 a2.3 2.3 0 0 1 4.6 0 v1.6" fill="none" stroke="${c}" stroke-width="1.2"/>`
  )
}

export interface RenderOptions {
  palette?: Palette
  width?: number
  /** 追加で展開する段数。0 = L1（メンバのみ）, 1 = L2（参照を1段展開）。 */
  expandLevels?: number
}

interface Row {
  indent: number
  depth: number
  glyph: string
  label: string
  optional?: boolean
  readonly?: boolean
  typeText?: string
  muted?: boolean
}

function resolveRef(t: TypeIR, defs: Record<string, TypeIR>): { type: TypeIR; name?: string } {
  if (t.kind === 'ref') {
    const d = defs[t.id]
    return { type: d ?? t, name: t.name }
  }
  return { type: t }
}

function isExpandable(t: TypeIR, defs: Record<string, TypeIR>): boolean {
  const { type } = resolveRef(t, defs)
  switch (type.kind) {
    case 'object':
    case 'class':
      return type.members.length > 0
    case 'union':
      return type.options.length > 0
    case 'enum':
      return type.members.length > 0
    case 'intersection':
      return type.parts.length > 0
    case 'array':
      return isExpandable(type.element, defs)
    case 'function':
    case 'record':
      return true
    default:
      return false
  }
}

// メンバ1件を行として積み、必要なら子を1段展開する。
function emitMember(m: Member, level: number, remaining: number, defs: Record<string, TypeIR>, rows: Row[]): void {
  rows.push({
    indent: level,
    depth: level,
    glyph: leadingGlyphId(m.type, defs),
    label: m.name,
    optional: m.optional,
    readonly: m.readonly,
    typeText: m.type.kind === 'function' ? `(…) => ${typeLabel(m.type.returns)}` : typeLabel(m.type),
  })
  if (remaining > 0 && isExpandable(m.type, defs)) {
    expandChildren(m.type, level + 1, remaining - 1, defs, rows)
  }
}

// 型の中身を level の行として展開する（ref/array は解決して委譲）。
function expandChildren(t: TypeIR, level: number, remaining: number, defs: Record<string, TypeIR>, rows: Row[]): void {
  const { type, name } = resolveRef(t, defs)
  switch (type.kind) {
    case 'object':
    case 'class':
      type.members.forEach((mm) => emitMember(mm, level, remaining, defs, rows))
      break
    case 'union':
      if (name) rows.push({ indent: level, depth: level, glyph: 'union', label: `${name} =`, muted: true })
      type.options.forEach((o) =>
        rows.push({ indent: level, depth: level, glyph: leadingGlyphId(o, defs), label: typeLabel(o), muted: true }),
      )
      break
    case 'enum':
      if (name) rows.push({ indent: level, depth: level, glyph: 'enum', label: `${name} =`, muted: true })
      type.members.forEach((mm) =>
        rows.push({
          indent: level,
          depth: level,
          glyph: 'enum',
          label: mm.value !== undefined ? `${mm.name} = ${mm.value}` : mm.name,
          muted: true,
        }),
      )
      break
    case 'intersection':
      type.parts.forEach((pt) => expandChildren(pt, level, remaining, defs, rows))
      break
    case 'array':
      expandChildren(type.element, level, remaining, defs, rows)
      break
    case 'function':
      type.params.forEach((prm) =>
        rows.push({
          indent: level,
          depth: level,
          glyph: leadingGlyphId(prm.type, defs),
          label: prm.name,
          optional: prm.optional,
          typeText: typeLabel(prm.type),
        }),
      )
      rows.push({
        indent: level,
        depth: level,
        glyph: leadingGlyphId(type.returns, defs),
        label: '↩ 戻り値',
        typeText: typeLabel(type.returns),
        muted: true,
      })
      break
    case 'record':
      rows.push({ indent: level, depth: level, glyph: leadingGlyphId(type.key, defs), label: 'キー', typeText: typeLabel(type.key), muted: true })
      rows.push({ indent: level, depth: level, glyph: leadingGlyphId(type.value, defs), label: '値', typeText: typeLabel(type.value), muted: true })
      break
    default:
      break
  }
}

// ── サマリーカード（expandLevels: 0=L1 / 1=L2 …）──
export function renderTypeCard(doc: Doc, opts: RenderOptions = {}): string {
  const p = opts.palette ?? LIGHT
  const W = opts.width ?? 480
  const expandLevels = opts.expandLevels ?? 0
  const padX = 16
  const headerH = 44
  const rowH = 32
  const indentStep = 20

  // root を解決（ref なら defs から実体を引く）
  let title = '(anonymous)'
  let target: TypeIR = doc.root
  if (doc.root.kind === 'ref') {
    title = doc.root.name
    target = doc.defs[doc.root.id]
  }
  if (!target || (target.kind !== 'object' && target.kind !== 'class')) {
    throw new Error('renderTypeCard: root は object / class 型に解決される必要があります')
  }
  if (target.kind === 'class') title = target.name
  const members = target.members

  // レイアウト（行リスト生成）と描画を分離する
  const rows: Row[] = []
  members.forEach((m) => emitMember(m, 1, expandLevels, doc.defs, rows))

  const H = headerH + rows.length * rowH + 10
  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif">`,
  )
  out.push(`<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="${p.panel}" stroke="${p.border}"/>`)
  out.push(`<line x1="0" y1="${headerH}" x2="${W}" y2="${headerH}" stroke="${p.divider}"/>`)
  // タイトル（深度0）
  out.push(glyph('object', padX, headerH / 2 - 8, depthColor(p, 0)))
  out.push(text(padX + 24, headerH / 2 + 5, title, { size: 14, color: p.ink, weight: 500, family: MONO }))
  out.push(text(W - padX, headerH / 2 + 4, `${members.length} members`, { size: 11, color: p.sub, anchor: 'end' }))

  rows.forEach((r, i) => {
    const top = headerH + i * rowH
    const cy = top + rowH / 2
    const glyphX = padX + r.indent * indentStep
    const nameX = glyphX + 22
    // トップレベル行の前に区切り線（展開した子行はまとめて見せる）
    if (i > 0 && r.indent === 1) {
      out.push(`<line x1="${padX}" y1="${top}" x2="${W - padX}" y2="${top}" stroke="${p.divider}"/>`)
    }
    // ネストの含有ガイド（縦線）
    if (r.indent >= 1) {
      out.push(`<line x1="${glyphX - 9}" y1="${top}" x2="${glyphX - 9}" y2="${top + rowH}" stroke="${p.divider}"/>`)
    }
    // 行頭グリフ（色＝深度）
    out.push(glyph(r.glyph, glyphX, cy - 8, depthColor(p, r.depth)))
    // 名前
    out.push(text(nameX, cy + 4, r.label, { size: 13, color: r.muted ? p.sub : p.ink, family: MONO }))
    // 修飾バッジ（シンボル）
    let bx = nameX + r.label.length * 7.4 + 7
    if (r.optional) {
      out.push(text(bx, cy + 4, '?', { size: 13, color: p.sub, family: MONO }))
      bx += 10
    }
    if (r.readonly) {
      out.push(badgeReadonly(bx, cy - 8, p.sub))
      bx += 12
    }
    // 型ラベル（右寄せ）
    if (r.typeText) {
      out.push(text(W - padX, cy + 4, r.typeText, { size: 12, color: p.sub, anchor: 'end', family: MONO }))
    }
  })

  out.push('</svg>')
  return out.join('\n')
}
