// 手書きの IR サンプル。これを静的SVGの L1 / L2 カードに描く。
//
// 元になる TypeScript:
//   interface User {
//     id: string
//     name: string
//     age?: number
//     readonly createdAt: Date
//     roles: Role[]
//     update(patch: Partial<User>): Promise<User>
//   }
//   type Role = 'admin' | 'editor' | 'viewer'

import { writeFileSync } from 'node:fs'
import type { Doc } from '../src/ir.ts'
import { renderTypeCard } from '../src/renderSvg.ts'

export const userDoc: Doc = {
  root: { kind: 'ref', id: 'User', name: 'User' },
  defs: {
    User: {
      kind: 'object',
      members: [
        { name: 'id', type: { kind: 'primitive', name: 'string' } },
        { name: 'name', type: { kind: 'primitive', name: 'string' } },
        { name: 'age', optional: true, type: { kind: 'primitive', name: 'number' } },
        { name: 'createdAt', readonly: true, type: { kind: 'opaque', name: 'Date', args: [] } },
        { name: 'roles', type: { kind: 'array', element: { kind: 'ref', id: 'Role', name: 'Role' } } },
        {
          name: 'update',
          type: {
            kind: 'function',
            params: [
              {
                name: 'patch',
                type: { kind: 'ref', id: 'Partial', name: 'Partial', args: [{ kind: 'ref', id: 'User', name: 'User' }] },
              },
            ],
            returns: { kind: 'opaque', name: 'Promise', args: [{ kind: 'ref', id: 'User', name: 'User' }] },
          },
        },
      ],
    },
    Role: {
      kind: 'union',
      options: [
        { kind: 'literal', base: 'string', value: 'admin' },
        { kind: 'literal', base: 'string', value: 'editor' },
        { kind: 'literal', base: 'string', value: 'viewer' },
      ],
    },
  },
}

// L1（メンバのみ） と L2（参照を1段展開） を出力
if (import.meta.main) {
  writeFileSync(new URL('./user.svg', import.meta.url), renderTypeCard(userDoc))
  writeFileSync(new URL('./user-l2.svg', import.meta.url), renderTypeCard(userDoc, { expandLevels: 1 }))
  console.log('wrote user.svg (L1) and user-l2.svg (L2)')
}
