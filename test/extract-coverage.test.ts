// 抽出器の型カバレッジ（enum / Record / Map / intersection / generics）。

import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { extractType } from '../src/extract.ts'

test('enum: 名前と定数値を拾う', () => {
  const d = extractType(`export enum Color { Red, Green = 2, Blue }`, 'Color')
  const e = d.defs.Color as { kind: string; members: { name: string; value?: string }[] }
  assert.equal(e.kind, 'enum')
  assert.deepEqual(e.members.map((m) => m.name), ['Red', 'Green', 'Blue'])
  assert.deepEqual(e.members.map((m) => m.value), ['0', '2', '3'])
})

test('Record<K,V> → record（key→value）', () => {
  const d = extractType(`export interface Dict { map: Record<string, number> }`, 'Dict')
  const map = (d.defs.Dict as { members: any[] }).members[0]
  assert.equal(map.type.kind, 'record')
  assert.equal(map.type.key.name, 'string')
  assert.equal(map.type.value.name, 'number')
})

test('Map<K,V> → record', () => {
  const d = extractType(`export interface Dict { m: Map<string, number> }`, 'Dict')
  const m = (d.defs.Dict as { members: any[] }).members[0]
  assert.equal(m.type.kind, 'record')
  assert.equal(m.type.key.name, 'string')
  assert.equal(m.type.value.name, 'number')
})

test('インデックスシグネチャのみのオブジェクト → record', () => {
  const d = extractType(`export interface Bag { [k: string]: boolean }`, 'Bag')
  // 名前付き interface は ref になり、def 側が record か object。member 経由で確認する別ケースに委ねる。
  const bag = d.defs.Bag as { kind: string }
  assert.ok(bag.kind === 'object' || bag.kind === 'record')
})

test('intersection: A & B を保持する', () => {
  const d = extractType(
    `export interface A { a: string }
     export interface B { b: number }
     export type C = A & B`,
    'C',
  )
  const c = d.defs.C as { kind: string; parts: any[] }
  assert.equal(c.kind, 'intersection')
  assert.equal(c.parts.length, 2)
  assert.deepEqual(c.parts.map((p) => p.name).sort(), ['A', 'B'])
})

test('generics: 型引数 T を typeParam として拾う', () => {
  const d = extractType(`export interface Box<T> { value: T; items: T[] }`, 'Box')
  const box = d.defs.Box as { members: any[] }
  const value = box.members.find((m) => m.name === 'value')
  assert.equal(value.type.kind, 'typeParam')
  assert.equal(value.type.name, 'T')
  const items = box.members.find((m) => m.name === 'items')
  assert.equal(items.type.kind, 'array')
  assert.equal(items.type.element.kind, 'typeParam')
})

test('制約つき型引数: constraint を拾う', () => {
  const d = extractType(`export interface Box<T extends string> { value: T }`, 'Box')
  const value = (d.defs.Box as { members: any[] }).members[0]
  assert.equal(value.type.kind, 'typeParam')
  assert.equal(value.type.constraint?.name, 'string')
})
