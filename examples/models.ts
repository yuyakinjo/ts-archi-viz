// CLI のサンプル入力（型定義のみ・自己完結）。
//   bun src/cli.ts examples/models.ts User > user.svg
//   bun src/cli.ts examples/models.ts --mode module --format html > map.html
export interface User {
  id: number
  name: string
  profile: Profile
  status: Status
}
export interface Profile {
  age: number
  email: string
}
export class Session {
  user: User
  token: string
}
export type Role = 'admin' | 'editor' | 'viewer'
export enum Status {
  Active,
  Archived,
}
export type Ids = number[]
