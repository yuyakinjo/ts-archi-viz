// 試作: セマンティックズーム「層」を、ユーザー提示の例で確認する（静的ストリップ）。
//   interface User { id: number; name: string; admin: boolean }

import { writeFileSync } from 'node:fs'
import { extractType } from '../src/extract.ts'
import { renderLayerStrip } from '../src/renderLayer.ts'

export const layerDoc = extractType(
  `export interface User {
    id: number
    name: string
    admin: boolean
  }`,
  'User',
)

if (import.meta.main) {
  writeFileSync(new URL('./layer-user.svg', import.meta.url), renderLayerStrip(layerDoc))
  console.log('wrote layer-user.svg')
}
