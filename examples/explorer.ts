// 試作: macro↔micro 連続ズーム。マップ→型をクリック→層ビュー→戻る。色モード切替つき。

import { writeFileSync } from 'node:fs'
import { renderExplorer } from '../src/renderExplorer.ts'

// 全シルエットが出る例題（interface=コンセント / class=波括弧破線 / object literal=波括弧実線 /
// array=角括弧破線 / tuple=角括弧実線 / enum=点 / union=重なり矩形）。
export const explorerSource = `
export interface User { id: number; name: string; profile: Profile; status: Status }
export interface Profile { age: number; email: string }
export class Session { user: User; token: string }
export type Point = { x: number; y: number }
export type Ids = number[]
export type Pair = [number, number]
export enum Status { Active, Archived }
export type Shape = Circle | Square
export interface Circle { kind: 'circle'; r: number }
export interface Square { kind: 'square'; size: number }
`

if (import.meta.main) {
  writeFileSync(new URL('./explorer.html', import.meta.url), renderExplorer(explorerSource))
  console.log('wrote explorer.html')
}
