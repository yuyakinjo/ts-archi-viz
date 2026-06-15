// 抽出器: TypeScript ソース → 正規化IR(Doc)。
// ts.TypeChecker で解決した型を歩いて TypeIR に落とす。レンダラとは独立した別エントリ。
//
// v1 が扱う種別: primitive / literal / special(any,unknown,never) / object・interface /
//   class / array / tuple / union / intersection / function / opaque(Promise,Date…) /
//   typeParam / ref（名前付き型は defs に巻き上げ、再帰は仮置きで断つ）。
// 未対応(将来): enum の列挙展開, Map/Record の key→value 展開, conditional/mapped の構造。

import ts from 'typescript'
import type { Doc, Member, Param, TypeIR } from './ir.ts'
import { OPAQUE_DEFAULTS } from './vocabulary.ts'

const MAP_LIKE = new Set(['Map', 'WeakMap', 'ReadonlyMap'])

export function createProgram(fileName: string, source: string): ts.Program {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  }
  const host = ts.createCompilerHost(options, true)
  const sf = ts.createSourceFile(fileName, source, options.target!, true, ts.ScriptKind.TS)
  const origGet = host.getSourceFile.bind(host)
  host.getSourceFile = (name, lv, onErr, shouldCreate) =>
    name === fileName ? sf : origGet(name, lv, onErr, shouldCreate)
  const origRead = host.readFile.bind(host)
  host.readFile = (name) => (name === fileName ? source : origRead(name))
  const origExists = host.fileExists.bind(host)
  host.fileExists = (name) => name === fileName || origExists(name)
  host.writeFile = () => {}
  return ts.createProgram([fileName], options, host)
}

export interface ExtractOptions {
  fileName?: string
}

// 指定した型名（interface / type / class / enum）を root に Doc を作る。
export function extractType(source: string, typeName: string, opts: ExtractOptions = {}): Doc {
  const fileName = opts.fileName ?? 'in-memory.ts'
  const program = createProgram(fileName, source)
  const checker = program.getTypeChecker()
  const sf = program.getSourceFile(fileName)
  if (!sf) throw new Error('ソースファイルを取得できませんでした')

  const declared = findDeclaredType(checker, sf, typeName)
  const defs: Record<string, TypeIR> = {}

  // 名前付き型を defs に巻き上げ、循環は仮置きで断つ。
  function named(id: string, name: string, build: () => TypeIR): TypeIR {
    if (!(id in defs)) {
      defs[id] = { kind: 'special', name: 'unknown' } // 循環を断つ仮置き
      defs[id] = build()
    }
    return { kind: 'ref', id, name }
  }

  function isReadonly(prop: ts.Symbol): boolean {
    return (prop.declarations ?? []).some(
      (d) => (ts.getCombinedModifierFlags(d) & ts.ModifierFlags.Readonly) !== 0,
    )
  }

  function memberFromSymbol(prop: ts.Symbol): Member {
    const decl = prop.valueDeclaration ?? prop.declarations?.[0]
    const t = checker.getTypeOfSymbolAtLocation(prop, decl ?? sf!)
    const optional = (prop.getFlags() & ts.SymbolFlags.Optional) !== 0
    const readonly = isReadonly(prop)
    // optional は型に undefined が混ざるので落として見やすくする
    if (optional && t.isUnion()) {
      const kept = (t as ts.UnionType).types.filter((x) => (x.flags & ts.TypeFlags.Undefined) === 0)
      const irs = kept.map((x) => typeToIR(x))
      const type = irs.length === 1 ? irs[0] : { kind: 'union' as const, options: irs }
      return { name: prop.name, type, optional, readonly }
    }
    return { name: prop.name, type: typeToIR(t), optional, readonly }
  }

  function buildObjectOrClass(type: ts.Type, sym: ts.Symbol): TypeIR {
    const members = type.getProperties().map(memberFromSymbol)
    if (sym.flags & ts.SymbolFlags.Class) return { kind: 'class', name: sym.name, members }
    return { kind: 'object', members, objectKind: 'interface' }
  }

  // enum 型はしばしば「enum リテラルの union」として現れ、union 自体は symbol を持たない。
  // その場合は各メンバの parent シンボル（enum 本体）を辿る。
  function enumSymbolOf(type: ts.Type): ts.Symbol | undefined {
    const direct = type.aliasSymbol ?? type.getSymbol()
    if (direct && direct.flags & ts.SymbolFlags.Enum) return direct
    if (type.isUnion()) {
      const opts = (type as ts.UnionType).types
      if (opts.length > 0 && opts.every((o) => o.flags & ts.TypeFlags.EnumLiteral)) {
        const parent = (opts[0].symbol as ts.Symbol & { parent?: ts.Symbol }).parent
        if (parent && parent.flags & ts.SymbolFlags.Enum) return parent
      }
    }
    return undefined
  }

  function buildEnum(sym: ts.Symbol): TypeIR {
    const decl = sym.declarations?.find(ts.isEnumDeclaration)
    const members = decl
      ? decl.members.map((m) => {
          const v = checker.getConstantValue(m)
          return { name: m.name.getText(), value: v !== undefined ? String(v) : undefined }
        })
      : []
    return { kind: 'enum', name: sym.name, members }
  }

  function paramFromSymbol(ps: ts.Symbol): Param {
    const pd = ps.valueDeclaration as ts.ParameterDeclaration | undefined
    const pt = checker.getTypeOfSymbolAtLocation(ps, pd ?? sf!)
    return {
      name: ps.name,
      type: typeToIR(pt),
      optional: pd ? !!pd.questionToken : false,
      rest: pd ? !!pd.dotDotDotToken : false,
    }
  }

  function typeToIR(type: ts.Type, ignoreAlias = false): TypeIR {
    const f = type.flags

    // 特殊・プリミティブ・リテラル
    if (f & ts.TypeFlags.Any) return { kind: 'special', name: 'any' }
    if (f & ts.TypeFlags.Unknown) return { kind: 'special', name: 'unknown' }
    if (f & ts.TypeFlags.Never) return { kind: 'special', name: 'never' }
    if (f & ts.TypeFlags.Void) return { kind: 'primitive', name: 'void' }
    if (f & ts.TypeFlags.Undefined) return { kind: 'primitive', name: 'undefined' }
    if (f & ts.TypeFlags.Null) return { kind: 'primitive', name: 'null' }
    if (f & ts.TypeFlags.StringLiteral) return { kind: 'literal', base: 'string', value: (type as ts.StringLiteralType).value }
    if (f & ts.TypeFlags.NumberLiteral) return { kind: 'literal', base: 'number', value: String((type as ts.NumberLiteralType).value) }
    if (f & ts.TypeFlags.BooleanLiteral) return { kind: 'literal', base: 'boolean', value: (type as { intrinsicName?: string }).intrinsicName ?? 'false' }
    if (f & ts.TypeFlags.String) return { kind: 'primitive', name: 'string' }
    if (f & ts.TypeFlags.Number) return { kind: 'primitive', name: 'number' }
    if (f & ts.TypeFlags.Boolean) return { kind: 'primitive', name: 'boolean' }
    if (f & ts.TypeFlags.BigInt) return { kind: 'primitive', name: 'bigint' }
    if (f & (ts.TypeFlags.ESSymbol | ts.TypeFlags.UniqueESSymbol)) return { kind: 'primitive', name: 'symbol' }
    if (f & ts.TypeFlags.TypeParameter) {
      const c = checker.getBaseConstraintOfType(type)
      return c
        ? { kind: 'typeParam', name: type.symbol?.name ?? 'T', constraint: typeToIR(c) }
        : { kind: 'typeParam', name: type.symbol?.name ?? 'T' }
    }

    // enum（alias/union 形より先に判定する。enum 型は aliasSymbol を持つため）
    const enumSym = enumSymbolOf(type)
    if (enumSym) {
      return named(enumSym.name, enumSym.name, () => buildEnum(enumSym))
    }

    // 名前付きエイリアス（Role, Partial<User> など）を優先して名前を保つ
    if (!ignoreAlias && type.aliasSymbol) {
      const name = type.aliasSymbol.name
      const args = (type.aliasTypeArguments ?? []).map((a) => typeToIR(a))
      if (name === 'Record' && args.length === 2) return { kind: 'record', key: args[0], value: args[1] }
      if (OPAQUE_DEFAULTS.has(name)) return { kind: 'opaque', name, args }
      if (args.length) return { kind: 'ref', id: checker.typeToString(type), name, args }
      return named(name, name, () => typeToIR(type, true))
    }

    // 配列・タプル
    if (checker.isArrayType(type)) {
      const el = checker.getTypeArguments(type as ts.TypeReference)[0]
      return { kind: 'array', element: el ? typeToIR(el) : { kind: 'special', name: 'unknown' } }
    }
    if (checker.isTupleType(type)) {
      const els = checker.getTypeArguments(type as ts.TypeReference)
      return { kind: 'tuple', elements: els.map((e) => typeToIR(e)) }
    }

    // ユニオン・インターセクション
    if (type.isUnion()) {
      const opts = (type as ts.UnionType).types
      if (opts.length === 2 && opts.every((o) => o.flags & ts.TypeFlags.BooleanLiteral)) {
        return { kind: 'primitive', name: 'boolean' }
      }
      return { kind: 'union', options: opts.map((o) => typeToIR(o)) }
    }
    if (type.isIntersection()) {
      return { kind: 'intersection', parts: (type as ts.IntersectionType).types.map((t) => typeToIR(t)) }
    }

    const sym = type.getSymbol()

    // 不透過ラッパー（Promise / Date / Set…）→ アイコン合成
    if (sym && OPAQUE_DEFAULTS.has(sym.name)) {
      const args = checker.getTypeArguments(type as ts.TypeReference) ?? []
      return { kind: 'opaque', name: sym.name, args: args.map((a) => typeToIR(a)) }
    }

    // Map 系 → record（key→value）
    if (sym && MAP_LIKE.has(sym.name)) {
      const args = checker.getTypeArguments(type as ts.TypeReference)
      if (args.length === 2) return { kind: 'record', key: typeToIR(args[0]), value: typeToIR(args[1]) }
    }

    // 関数
    const calls = type.getCallSignatures()
    if (calls.length > 0) {
      const sig = calls[0]
      return {
        kind: 'function',
        params: sig.getParameters().map(paramFromSymbol),
        returns: typeToIR(sig.getReturnType()),
      }
    }

    // 名前付き object / interface / class → ref + defs
    if (sym && sym.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.Class)) {
      return named(sym.name, sym.name, () => buildObjectOrClass(type, sym))
    }
    // 匿名オブジェクト（インデックスシグネチャのみなら record）
    if (f & ts.TypeFlags.Object) {
      const indexInfos = checker.getIndexInfosOfType(type)
      if (indexInfos.length > 0 && type.getProperties().length === 0) {
        return { kind: 'record', key: typeToIR(indexInfos[0].keyType), value: typeToIR(indexInfos[0].type) }
      }
      return { kind: 'object', members: type.getProperties().map(memberFromSymbol), objectKind: 'literal' }
    }

    // フォールバック（未対応の種別は名前だけ拾う）
    const label = checker.typeToString(type)
    return { kind: 'ref', id: label, name: label }
  }

  const root = typeToIR(declared)
  return { root, defs }
}

function findDeclaredType(checker: ts.TypeChecker, sf: ts.SourceFile, name: string): ts.Type {
  for (const st of sf.statements) {
    if (
      (ts.isInterfaceDeclaration(st) ||
        ts.isClassDeclaration(st) ||
        ts.isTypeAliasDeclaration(st) ||
        ts.isEnumDeclaration(st)) &&
      st.name &&
      st.name.text === name
    ) {
      const sym = checker.getSymbolAtLocation(st.name)
      if (sym) return checker.getDeclaredTypeOfSymbol(sym)
    }
  }
  throw new Error(`型 ${name} が見つかりません`)
}
