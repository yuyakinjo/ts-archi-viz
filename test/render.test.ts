// 静的SVGレンダラの回帰テスト（bun:test）。
// 「抽出 → IR → レンダラ」を分離したので、手書きの Doc を入れて出力SVGを固定できる。
//
//   bun test                       # 検証
//   UPDATE_SNAPSHOTS=1 bun test    # 意図した変更を反映

import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { renderTypeCard } from '../src/renderSvg.ts'
import { userDoc } from '../examples/user.ts'

const SNAP_DIR = new URL('./__snapshots__/', import.meta.url)

function matchSnapshot(name: string, content: string): void {
  mkdirSync(SNAP_DIR, { recursive: true })
  const file = new URL(`${name}.svg`, SNAP_DIR)
  if (process.env.UPDATE_SNAPSHOTS || !existsSync(file)) {
    writeFileSync(file, content)
    console.log(`snapshot ${process.env.UPDATE_SNAPSHOTS ? 'updated' : 'created'}: ${name}.svg`)
    return
  }
  assert.equal(
    content,
    readFileSync(file, 'utf8'),
    `snapshot 不一致: ${name}.svg（意図した変更なら UPDATE_SNAPSHOTS=1 で更新）`,
  )
}

const l1 = renderTypeCard(userDoc)
const l2 = renderTypeCard(userDoc, { expandLevels: 1 })

test('L1: メンバと型が出る／参照は展開されない', () => {
  assert.ok(l1.includes('>User<'), 'タイトル User')
  assert.ok(l1.includes('>string<'), 'string 型ラベル')
  assert.ok(l1.includes('Role[]'), 'roles の型ラベル')
  assert.ok(l1.includes('Promise&lt;User&gt;'), 'update の戻り値（< > はエスケープされる）')
  assert.ok(!l1.includes('admin'), 'L1 では union が展開されない')
})

test('L2: roles と update が1段展開される', () => {
  assert.ok(l2.includes('Role ='), 'union の見出し')
  assert.ok(l2.includes('&quot;admin&quot;'), 'リテラル admin が出る')
  assert.ok(l2.includes('>patch<'), '関数引数 patch が出る')
  assert.ok(l2.includes('戻り値'), '関数の戻り値行が出る')
})

test('色＝深度: L2 には深度2の色(amber)が現れ、L1には無い', () => {
  assert.ok(!l1.includes('#d97706'), 'L1 は深度1(teal)まで')
  assert.ok(l2.includes('#d97706'), 'L2 は深度2(amber)が出る')
  assert.ok(l2.includes('#2563eb') && l2.includes('#0d9488'), 'L2 は深度0(blue),1(teal)も含む')
})

test('snapshot: L1', () => matchSnapshot('user.l1', l1))
test('snapshot: L2', () => matchSnapshot('user.l2', l2))
