// CLI（引数パース＋ソース→出力の純関数）のテスト。

import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { parseArgs, renderFromSource } from '../src/cli.ts'

const src = `export interface User { id: number; name: string; profile: Profile }
export interface Profile { age: number; email: string }
export enum Status { A, B }`

test('parseArgs: 位置引数とフラグ', () => {
  const o = parseArgs(['f.ts', 'User', '--format', 'html', '--color', 'heatmap', '--expand', '1', '--out', 'x.html'])
  assert.equal(o.file, 'f.ts')
  assert.equal(o.typeName, 'User')
  assert.equal(o.format, 'html')
  assert.equal(o.color, 'heatmap')
  assert.equal(o.expand, 1)
  assert.equal(o.out, 'x.html')
})

test('parseArgs: --key=val 形式', () => {
  const o = parseArgs(['f.ts', '--mode=module', '--format=svg'])
  assert.equal(o.mode, 'module')
  assert.equal(o.format, 'svg')
  assert.equal(o.typeName, undefined)
})

test('type+svg（型名ありの既定）', () => {
  const out = renderFromSource(src, { typeName: 'User' })
  assert.ok(out.startsWith('<svg'))
  assert.ok(out.includes('User'))
})

test('type+html は自己完結ドキュメント', () => {
  const out = renderFromSource(src, { typeName: 'User', format: 'html' })
  assert.ok(out.startsWith('<!DOCTYPE html'))
  assert.ok(out.includes('class="iz"'))
})

test('module+svg（型名なしの既定＝マップ）', () => {
  const out = renderFromSource(src, {})
  assert.ok(out.startsWith('<svg'))
  assert.ok(out.includes('User') && out.includes('Profile'))
})

test('module+html は explorer', () => {
  const out = renderFromSource(src, { format: 'html' })
  assert.ok(out.startsWith('<!DOCTYPE html'))
  assert.ok(out.includes('ex-mode'))
})

test('type モードで型名が無ければエラー', () => {
  assert.throws(() => renderFromSource(src, { mode: 'type' }))
})
