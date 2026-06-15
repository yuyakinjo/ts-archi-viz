// 試作: モジュールマップ（役割俯瞰）。役割が散らばる小さなモジュールを地図化する。

import { writeFileSync } from 'node:fs'
import { extractModule } from '../src/extractModule.ts'
import { renderModuleMap } from '../src/renderModuleMap.ts'

export const moduleSource = `
export interface User { id: number; name: string; profile: Profile; role: Role }
export interface Profile { age: number; email: string }
export interface Session { user: User; token: string }
export type Role = 'admin' | 'editor' | 'viewer'
export type Shape = Circle | Square
export interface Circle { kind: 'circle'; r: number }
export interface Square { kind: 'square'; size: number }
export interface UserService {
  get(id: number): Promise<User>
  save(u: User): void
}
`

export const moduleDoc = extractModule(moduleSource)

if (import.meta.main) {
  console.log(JSON.stringify(moduleDoc, null, 2))
  writeFileSync(new URL('./module-map.svg', import.meta.url), renderModuleMap(moduleDoc))
  console.log('\nwrote module-map.svg')
}
