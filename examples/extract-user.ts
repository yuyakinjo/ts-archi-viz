// 実ソース（手書きIRではない）から抽出 → 描画 までを通す。
// 手書きの examples/user.ts と同じ型を、今度は TypeScript ソースから自動生成する。

import { writeFileSync } from 'node:fs'
import { extractType } from '../src/extract.ts'
import { renderTypeCard } from '../src/renderSvg.ts'

export const userSource = `
export interface User {
  id: string
  name: string
  age?: number
  readonly createdAt: Date
  roles: Role[]
  update(patch: Partial<User>): Promise<User>
}
export type Role = 'admin' | 'editor' | 'viewer'
`

export const extractedUserDoc = extractType(userSource, 'User')

if (import.meta.main) {
  console.log(JSON.stringify(extractedUserDoc, null, 2))
  writeFileSync(new URL('./extract-user.svg', import.meta.url), renderTypeCard(extractedUserDoc))
  writeFileSync(new URL('./extract-user-l2.svg', import.meta.url), renderTypeCard(extractedUserDoc, { expandLevels: 1 }))
  console.log('\nwrote extract-user.svg (L1) and extract-user-l2.svg (L2)')
}
