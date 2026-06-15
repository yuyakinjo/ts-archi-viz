// モジュール抽出（役割・重み・参照エッジ・境界昇格）の回帰テスト。

import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { extractModule } from '../src/extractModule.ts'
import { moduleDoc } from '../examples/module-map.ts'

test('役割分類', () => {
  assert.equal(moduleDoc.types.User.role, 'boundary') // fanIn>=2 で昇格
  assert.equal(moduleDoc.types.Role.role, 'enum')
  assert.equal(moduleDoc.types.Shape.role, 'variant')
  assert.equal(moduleDoc.types.UserService.role, 'operation')
  assert.equal(moduleDoc.types.Profile.role, 'data')
})

test('重み（メンバ/選択肢の数）', () => {
  assert.equal(moduleDoc.types.User.weight, 4)
  assert.equal(moduleDoc.types.Role.weight, 3)
})

test('参照エッジ', () => {
  const has = (f: string, t: string) => moduleDoc.edges.some((e) => e.from === f && e.to === t)
  assert.ok(has('User', 'Profile'))
  assert.ok(has('User', 'Role'))
  assert.ok(has('Session', 'User'))
  assert.ok(has('Shape', 'Circle'))
  assert.ok(has('UserService', 'User'))
})

test('境界昇格は exported かつ fanIn>=2 のみ（Profile は data のまま）', () => {
  assert.equal(moduleDoc.types.Profile.role, 'data')
})

test('maxDepth（透過的な入れ子の最深・heatmap色用）', () => {
  assert.equal(moduleDoc.types.Session.maxDepth, 3) // Session→User→Profile→葉
  assert.equal(moduleDoc.types.User.maxDepth, 2) // User→Profile→葉
  assert.equal(moduleDoc.types.Profile.maxDepth, 1)
  assert.equal(moduleDoc.types.Role.maxDepth, 0) // リテラルunion
})

test('boundaryFanIn を上げると User も data に戻る', () => {
  const doc = extractModule(
    `export interface A { b: B }
     export interface B { x: number }`,
    { boundaryFanIn: 99 },
  )
  assert.equal(doc.types.B.role, 'data')
})
