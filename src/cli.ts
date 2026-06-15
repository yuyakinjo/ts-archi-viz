#!/usr/bin/env bun
// CLI: TypeScript ソースファイルから型ビジュアルを出力する。
//   typeviz <file.ts> [TypeName] [--mode type|module] [--format svg|html]
//                                [--color indent|heatmap] [--expand N] [--out path]
// 既定: 型名あり=type / 省略=module、format=svg。
// html は CSS変数を同梱した自己完結ドキュメントで出す（ブラウザでそのまま開ける）。
//
// 注意(MVP): ソースは単一ファイルとして読む。他ファイルへの import 先の型は未解決
// （その型名の参照ノードとして表示）。クロスファイル解決は今後の課題。

import { readFileSync, writeFileSync } from 'node:fs'
import { extractType } from './extract.ts'
import { extractModule } from './extractModule.ts'
import { renderTypeCard } from './renderSvg.ts'
import { renderInteractive } from './renderInteractive.ts'
import { renderModuleMap } from './renderModuleMap.ts'
import { renderExplorer } from './renderExplorer.ts'

export interface CliOptions {
  file?: string
  typeName?: string
  mode?: 'type' | 'module'
  format?: 'svg' | 'html'
  color?: 'indent' | 'heatmap'
  expand?: number
  out?: string
  help?: boolean
}

export function parseArgs(argv: string[]): CliOptions {
  const o: CliOptions = {}
  const pos: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') {
      o.help = true
    } else if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      const key = eq >= 0 ? a.slice(2, eq) : a.slice(2)
      const val = eq >= 0 ? a.slice(eq + 1) : argv[++i]
      if (key === 'mode') o.mode = val as CliOptions['mode']
      else if (key === 'format') o.format = val as CliOptions['format']
      else if (key === 'color') o.color = val as CliOptions['color']
      else if (key === 'expand') o.expand = Number(val)
      else if (key === 'out') o.out = val
    } else {
      pos.push(a)
    }
  }
  o.file = pos[0]
  o.typeName = pos[1]
  return o
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// CSS変数を同梱した自己完結HTML（ブラウザで直接開ける）
function htmlDoc(fragment: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — ts-archi-viz</title>
<style>
:root{--font-sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--color-text-primary:#111827;--color-text-secondary:#4b5563;--color-text-tertiary:#9aa1a9;--color-border-secondary:#d1d5db;--color-border-primary:#9ca3af;--color-background-primary:#ffffff;--color-background-secondary:#f3f4f6;--border-radius-md:8px;--border-radius-lg:12px}
body{margin:0;padding:16px;background:#fff;color:var(--color-text-primary);font-family:var(--font-sans)}
.wrap{max-width:760px;margin:0 auto}
</style></head><body><div class="wrap">${fragment}</div></body></html>`
}

// ソース文字列＋オプション → 出力文字列（fs に依存しない純関数。テスト可能）
export function renderFromSource(source: string, o: CliOptions): string {
  const mode = o.mode ?? (o.typeName ? 'type' : 'module')
  const format = o.format ?? 'svg'
  if (mode === 'type') {
    if (!o.typeName) throw new Error('type モードには型名が必要です（例: typeviz file.ts User）')
    const doc = extractType(source, o.typeName)
    if (format === 'html') return htmlDoc(renderInteractive(doc), o.typeName)
    return renderTypeCard(doc, { expandLevels: o.expand ?? 0 })
  }
  // module
  if (format === 'html') return htmlDoc(renderExplorer(source), 'module map')
  return renderModuleMap(extractModule(source), { colorMode: o.color ?? 'heatmap' })
}

const USAGE = `ts-archi-viz — TypeScript の型を可視化する CLI

使い方:
  typeviz <file.ts> [TypeName] [options]

引数:
  <file.ts>     対象の TypeScript ファイル
  [TypeName]    型名（指定すると type モード。省略すると module モード）

オプション:
  --mode    type|module    既定: 型名あり=type / 省略=module
  --format  svg|html       既定: svg（html は自己完結ドキュメント）
  --color   indent|heatmap module の色モード（既定: heatmap）
  --expand  <N>            type+svg の展開段数（既定: 0 = L1）
  --out     <path>         出力先（既定: 標準出力）
  -h, --help               このヘルプ

例:
  typeviz src/models.ts User > user.svg
  typeviz src/models.ts User --format html > user.html
  typeviz src/models.ts --mode module --format html > map.html
  typeviz src/models.ts --color heatmap > map.svg`

function main(): void {
  const o = parseArgs(process.argv.slice(2))
  if (o.help) {
    process.stdout.write(USAGE + '\n')
    return
  }
  if (!o.file) {
    process.stderr.write(USAGE + '\n')
    process.exit(1)
  }
  const source = readFileSync(o.file, 'utf8')
  const out = renderFromSource(source, o)
  if (o.out) {
    writeFileSync(o.out, out)
    process.stderr.write(`wrote ${o.out}\n`)
  } else {
    process.stdout.write(out)
  }
}

if (import.meta.main) main()
