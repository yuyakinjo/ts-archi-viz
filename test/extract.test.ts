// 抽出器の回帰テスト。実ソースから作った IR が期待構造になること、
// および手書きIRと同一のSVGを生む（＝抽出とレンダラの結線）ことを確認する。

import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { extractType } from '../src/extract.ts'
import { renderTypeCard } from '../src/renderSvg.ts'
import { extractedUserDoc } from '../examples/extract-user.ts'
import { userDoc } from '../examples/user.ts'

test('抽出: root は User への ref', () => {
  assert.equal(extractedUserDoc.root.kind, 'ref')
  assert.equal((extractedUserDoc.root as { name?: string }).name, 'User')
})

test('抽出: User の構造（順序・optional・readonly・opaque）', () => {
  const u = extractedUserDoc.defs.User as { kind: string; members: any[] }
  assert.equal(u.kind, 'object')
  assert.deepEqual(u.members.map((m) => m.name), ['id', 'name', 'age', 'createdAt', 'roles', 'update'])
  assert.ok(u.members.find((m) => m.name === 'age').optional, 'age は optional')
  const createdAt = u.members.find((m) => m.name === 'createdAt')
  assert.ok(createdAt.readonly, 'createdAt は readonly')
  assert.equal(createdAt.type.kind, 'opaque')
  assert.equal(createdAt.type.name, 'Date')
})

test('抽出: Role は string リテラル3つの union', () => {
  const r = extractedUserDoc.defs.Role as { kind: string; options: any[] }
  assert.equal(r.kind, 'union')
  assert.deepEqual(r.options.map((o) => o.value), ['admin', 'editor', 'viewer'])
})

test('抽出IRと手書きIRは同一のSVGを生む（結線の確認）', () => {
  assert.equal(renderTypeCard(extractedUserDoc), renderTypeCard(userDoc))
  assert.equal(
    renderTypeCard(extractedUserDoc, { expandLevels: 1 }),
    renderTypeCard(userDoc, { expandLevels: 1 }),
  )
})

test('別ソースも抽出できる（class）', () => {
  const doc = extractType(
    `export class Point {
      readonly x = 0
      y = 0
      move(dx: number, dy: number): void {}
    }`,
    'Point',
  )
  assert.equal(doc.root.kind, 'ref')
  const p = doc.defs.Point as { kind: string; members: any[] }
  assert.equal(p.kind, 'class')
  assert.deepEqual(p.members.map((m) => m.name), ['x', 'y', 'move'])
  assert.equal(p.members.find((m) => m.name === 'move').type.kind, 'function')
})
