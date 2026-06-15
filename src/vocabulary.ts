// 視覚語彙（テーマ）の設定。「1チャネル1意味」をデータとして持つ層。
// kind → どのチャネルで表すか、色（深度ramp）、不透過ラッパーの線引き、を集約する。
// 将来ここをユーザー設定で上書きできるようにする。

import type { RoleKey } from './ir.ts'

export interface Palette {
  panel: string
  border: string
  divider: string
  ink: string
  sub: string
  /** 深度ramp: 寒色（浅い）→ 暖色（深い）。index は深度、末尾でクランプ。 */
  depthRamp: string[]
}

export const LIGHT: Palette = {
  panel: '#ffffff',
  border: '#e5e7eb',
  divider: '#eef1f4',
  ink: '#111827',
  sub: '#6b7280',
  depthRamp: ['#2563eb', '#0d9488', '#d97706', '#dc2626'],
}

export function depthColor(p: Palette, depth: number): string {
  const r = p.depthRamp
  return r[Math.min(Math.max(depth, 0), r.length - 1)]
}

// 不透過ラッパー（中身を展開せずアイコン合成で表す既知のジェネリック）。
// 抽出器がこの集合を見て kind を 'opaque' にするか集約として展開するかを決める。
export const OPAQUE_DEFAULTS = new Set<string>([
  'Promise',
  'Date',
  'Set',
  'WeakSet',
  'RegExp',
  'Ref',
  'Observable',
])

// 既知ラッパー名 → グリフID（renderSvg の glyph() が解釈する）。
export const OPAQUE_GLYPH: Record<string, string> = {
  Promise: 'promise',
  Date: 'calendar',
  Set: 'default',
  RegExp: 'default',
}

// ── macro（モジュールマップ）の役割→色（categorical）。色=役割の主チャネル。──
export const ROLE_COLORS: Record<RoleKey, string> = {
  data: '#2563eb',
  boundary: '#dc2626',
  enum: '#d97706',
  variant: '#7c3aed',
  operation: '#16a34a',
  effect: '#db2777',
  utility: '#6b7280',
  alias: '#94a3b8',
}

export const ROLE_LABELS: Record<RoleKey, string> = {
  data: 'データ',
  boundary: '境界/API',
  enum: '列挙/状態',
  variant: 'バリアント',
  operation: '操作',
  effect: '効果',
  utility: '汎用',
  alias: '別名',
}
