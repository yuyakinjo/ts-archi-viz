// 種類ごとの器シルエットと小アイコン（renderInteractive / renderModuleMap で共有）。
// 副言語: 底面 実線=固定/破線=可変 ・ 天面 実線=interface契約あり(object)。
//   interface=コンセント / object=波括弧(上下実線) / class=波括弧(底面破線) /
//   array=角括弧(底面破線) / tuple=角括弧(底面実線) / union=重なり矩形 / enum=点 / その他=角丸。
// 色はすべて currentColor（呼び出し側が深度色を与える）。

import type { TypeIR } from './ir.ts'

export function shapeOf(t: TypeIR): string {
  switch (t.kind) {
    case 'object':
      return t.objectKind === 'interface' ? 'interface' : 'object'
    case 'class':
      return 'class'
    case 'array':
      return 'array'
    case 'tuple':
      return 'tuple'
    case 'enum':
      return 'enum'
    case 'union':
      return 'union'
    case 'record':
      return 'record'
    case 'function':
      return 'function'
    default:
      return 'default'
  }
}

export function resolveShapeKind(t: TypeIR, defs: Record<string, TypeIR>): string {
  let x: TypeIR = t
  if (t.kind === 'ref') {
    const d = defs[t.id]
    if (d) x = d
  }
  return shapeOf(x)
}

// メンバ行などの小アイコン用の種別（プリミティブ＋集約形）
export function glyphKindOf(t: TypeIR, defs: Record<string, TypeIR>): string {
  switch (t.kind) {
    case 'primitive':
      return t.name === 'string' || t.name === 'number' || t.name === 'boolean' ? t.name : 'symbol'
    case 'literal':
      return t.base
    case 'ref': {
      const d = defs[t.id]
      return d ? glyphKindOf(d, defs) : 'default'
    }
    default:
      return shapeOf(t)
  }
}

// 容器の輪郭（(0,0)-(W,H)）。enum は容器を持たない（呼び出し側で点を描く）→ '' を返す。
export function containerOutline(shape: string, W: number, H: number): string {
  const A = `stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
  const dash = `stroke-dasharray="6 5"`
  const r = 8
  const seg = (H - 4 * r) / 2
  const braceL = `M ${2 * r} 0 q ${-r} 0 ${-r} ${r} v ${seg} q 0 ${r} ${-r} ${r} q ${r} 0 ${r} ${r} v ${seg} q 0 ${r} ${r} ${r}`
  const braceR = `M ${W - 2 * r} 0 q ${r} 0 ${r} ${r} v ${seg} q 0 ${r} ${r} ${r} q ${-r} 0 ${-r} ${r} v ${seg} q 0 ${r} ${-r} ${r}`
  const brkL = `M 14 0 L 0 0 L 0 ${H}`
  const brkR = `M ${W - 14} 0 L ${W} 0 L ${W} ${H}`
  switch (shape) {
    case 'interface': {
      const cx = W / 2
      return (
        `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" ${A}/>` +
        `<rect x="${cx - 9}" y="14" width="6" height="26" rx="3" stroke="currentColor" fill="none" stroke-width="1.6"/>` +
        `<rect x="${cx + 3}" y="14" width="6" height="26" rx="3" stroke="currentColor" fill="none" stroke-width="1.6"/>`
      )
    }
    case 'object':
    case 'record':
      return (
        `<path d="${braceL}" ${A}/><path d="${braceR}" ${A}/>` +
        `<path d="M ${2 * r} 0 L ${W - 2 * r} 0" ${A}/>` +
        `<path d="M ${2 * r} ${H} L ${W - 2 * r} ${H}" ${A}/>`
      )
    case 'class':
      return (
        `<path d="${braceL}" ${A}/><path d="${braceR}" ${A}/>` +
        `<path d="M ${2 * r} ${H} L ${W - 2 * r} ${H}" ${A} ${dash}/>`
      )
    case 'tuple':
      return `<path d="${brkL}" ${A}/><path d="${brkR}" ${A}/><path d="M 0 ${H} L ${W} ${H}" ${A}/>`
    case 'array':
      return `<path d="${brkL}" ${A}/><path d="${brkR}" ${A}/><path d="M 0 ${H} L ${W} ${H}" ${A} ${dash}/>`
    case 'union':
      return (
        `<rect x="1" y="${H * 0.14}" width="${W * 0.72}" height="${H * 0.72}" rx="12" ${A}/>` +
        `<rect x="${W * 0.28 - 1}" y="${H * 0.14}" width="${W * 0.72}" height="${H * 0.72}" rx="12" ${A}/>`
      )
    case 'enum':
      return '' // 点で表す（呼び出し側）
    default:
      return `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" ${A}/>`
  }
}

// 小アイコン（中心0,0, ~16px）。currentColor。
export function miniGlyph(kind: string): string {
  const s = `stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"`
  const f = `fill="currentColor"`
  const dash = `stroke-dasharray="3 2.5"`
  switch (kind) {
    case 'string':
      return `<path d="M-6 -5 l2.8 0 l-1 3.6 l-1.8 0 z" ${f}/><path d="M-1 -5 l2.8 0 l-1 3.6 l-1.8 0 z" ${f}/>`
    case 'number':
      return `<path d="M-1 -6 L-3 6 M4 -6 L2 6 M-6 -2 L6 -2 M-7 2 L5 2" ${s}/>`
    case 'boolean':
      return `<rect x="-7" y="-3.5" width="15" height="7" rx="3.5" ${s}/><circle cx="4.5" cy="0" r="2.1" ${f}/>`
    case 'interface':
      return `<rect x="-7" y="-7" width="14" height="14" rx="3" ${s}/><rect x="-3.5" y="-5" width="2.4" height="6" rx="1.2" ${f}/><rect x="1.1" y="-5" width="2.4" height="6" rx="1.2" ${f}/>`
    case 'object':
      return `<path d="M-7 -7 H7 M-7 -7 V7 M7 -7 V7 M-7 7 H7" ${s}/><path d="M-4 -2 H4 M-4 2 H1" ${s}/>`
    case 'class':
      return `<path d="M-7 -7 H7 M-7 -7 V7 M7 -7 V7" ${s}/><path d="M-7 7 H7" ${s} ${dash}/>`
    case 'array':
      return `<path d="M-4 -6 L-7 -6 L-7 6 M4 -6 L7 -6 L7 6" ${s}/><path d="M-7 6 L7 6" ${s} ${dash}/>`
    case 'tuple':
      return `<path d="M-4 -6 L-7 -6 L-7 6 M4 -6 L7 -6 L7 6" ${s}/><path d="M-7 6 L7 6" ${s}/>`
    case 'enum':
      return `<circle cx="-4.5" cy="0" r="1.5" ${f}/><circle cx="0" cy="0" r="1.5" ${f}/><circle cx="4.5" cy="0" r="1.5" ${f}/>`
    case 'union':
      return `<rect x="-7" y="-4" width="9" height="8" rx="2" ${s}/><rect x="-2" y="-4" width="9" height="8" rx="2" ${s}/>`
    case 'function':
      return `<path d="M-6 -5 l3 5 l-3 5" ${s}/><path d="M-1 -5 l3 5 l-3 5" ${s}/>`
    case 'record':
      return `<rect x="-7" y="-6" width="14" height="12" rx="2" ${s}/><path d="M0 -6 V6 M-7 0 H7" ${s}/>`
    default:
      return `<rect x="-8" y="-7" width="16" height="14" rx="3" ${s}/><path d="M-3 -2 l-2 2 l2 2 M3 -2 l2 2 l-2 2" ${s}/>`
  }
}
