// 試作: IR駆動のインタラクティブ・セマンティックズーム（層×深度）。
// profile をネストさせ、第4層で開くと深度色（深2＝アンバー）が効くのを確認する。

import { writeFileSync } from 'node:fs'
import { extractType } from '../src/extract.ts'
import { renderInteractive } from '../src/renderInteractive.ts'

export const interactiveDoc = extractType(
  `export interface User {
    id: number
    name: string
    profile: Profile
    admin: boolean
  }
  export interface Profile {
    age: number
    email: string
  }`,
  'User',
)

if (import.meta.main) {
  writeFileSync(new URL('./interactive-user.html', import.meta.url), renderInteractive(interactiveDoc))
  console.log('wrote interactive-user.html')
}
