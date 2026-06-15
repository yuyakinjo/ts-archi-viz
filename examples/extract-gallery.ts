// 拡大したカバレッジを1枚で確認するギャラリー。
// enum / Record / intersection / generics(typeParam) / opaque / ref を1つの型に詰める。

import { writeFileSync } from 'node:fs'
import { extractType } from '../src/extract.ts'
import { renderTypeCard } from '../src/renderSvg.ts'

export const gallerySource = `
export enum Status { Active, Archived }
export interface User { name: string }
export interface Project<T> {
  id: string
  status: Status
  tags: Record<string, number>
  owner: User & { admin: boolean }
  createdAt: Date
  payload: T
}
`

export const projectDoc = extractType(gallerySource, 'Project')

if (import.meta.main) {
  console.log(JSON.stringify(projectDoc, null, 2))
  writeFileSync(new URL('./gallery.svg', import.meta.url), renderTypeCard(projectDoc, { expandLevels: 1 }))
  console.log('\nwrote gallery.svg (L2)')
}
