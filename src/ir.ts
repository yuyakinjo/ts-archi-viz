// 正規化された型IR（JSONシリアライズ可能）。
// これは「型の形＝仕様」であって描画とは独立。抽出器(ts.TypeChecker→Doc)と
// レンダラ(Doc→SVG/HTML)はこのIRを介して疎結合になる。

export type TypeId = string

export type Primitive =
  | 'string'
  | 'number'
  | 'boolean'
  | 'bigint'
  | 'symbol'
  | 'null'
  | 'undefined'
  | 'void'

export interface Member {
  name: string
  type: TypeIR
  optional?: boolean
  readonly?: boolean
}

export interface Param {
  name: string
  type: TypeIR
  optional?: boolean
  rest?: boolean
}

export interface MappedMod {
  optional?: '+' | '-'
  readonly?: '+' | '-'
}

export type TypeIR =
  // 原子 → アイコン
  | { kind: 'primitive'; name: Primitive }
  | { kind: 'literal'; base: 'string' | 'number' | 'boolean'; value: string }
  // 危険 → シンボル（深度rampの外）
  | { kind: 'special'; name: 'any' | 'unknown' | 'never' }
  // 集約 → 形
  | { kind: 'object'; members: Member[]; objectKind?: 'interface' | 'literal' }
  | { kind: 'array'; element: TypeIR }
  | { kind: 'tuple'; elements: TypeIR[] }
  | { kind: 'class'; name: string; members: Member[] }
  | { kind: 'enum'; name: string; members: { name: string; value?: string }[] }
  | { kind: 'record'; key: TypeIR; value: TypeIR } // Record / Map
  // 不透過ラッパー → アイコン合成
  | { kind: 'opaque'; name: string; args: TypeIR[] } // Promise / Set / Ref…
  // 演算子 → シンボル
  | { kind: 'union'; options: TypeIR[] }
  | { kind: 'intersection'; parts: TypeIR[] }
  // 動詞 → 形（＋任意でアニメ）
  | { kind: 'function'; params: Param[]; returns: TypeIR }
  | { kind: 'conditional'; check: TypeIR; ext: TypeIR; then: TypeIR; else: TypeIR }
  | { kind: 'mapped'; key: string; constraint: TypeIR; value: TypeIR; mod?: MappedMod }
  // ジェネリクス / 参照
  | { kind: 'typeParam'; name: string; constraint?: TypeIR } // 空きスロット
  | { kind: 'ref'; id: TypeId; name: string; args?: TypeIR[] } // defs参照（再帰対応）

export interface Doc {
  root: TypeIR
  defs: Record<TypeId, TypeIR>
}

// ── macro（モジュールマップ）用の軽量IR ──
export type RoleKey =
  | 'data' // データモデル/エンティティ
  | 'boundary' // 境界・公開API（被参照が多い）
  | 'enum' // 列挙・状態
  | 'variant' // バリアント/直和
  | 'operation' // 操作・振る舞い
  | 'effect' // 効果・ラッパー
  | 'utility' // ユーティリティ/汎用
  | 'alias' // 別名・ブランド

export interface ModuleType {
  id: TypeId
  name: string
  role: RoleKey
  weight: number
  /** この型の内部に到達できる最大の入れ子深さ（heatmap色用・循環は打ち切り）。 */
  maxDepth: number
  exported: boolean
  kind: string
  /** マップノードの器シルエット種別（shapeOf 由来。interface/object/class/array/…）。 */
  shape: string
}

// 色モード: indent=各要素を自分の深さで / heatmap=配下の最深で塗る。
export type ColorMode = 'indent' | 'heatmap'

export interface ModuleEdge {
  from: TypeId
  to: TypeId
}

export interface ModuleDoc {
  types: Record<TypeId, ModuleType>
  edges: ModuleEdge[]
}
