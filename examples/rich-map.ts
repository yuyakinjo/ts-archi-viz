// 全シルエットが出るリッチ例題のモジュールマップ（種類別ノード形の確認用）。

import { writeFileSync } from 'node:fs'
import { explorerSource } from './explorer.ts'
import { extractModule } from '../src/extractModule.ts'
import { renderModuleMap } from '../src/renderModuleMap.ts'

if (import.meta.main) {
  const doc = extractModule(explorerSource)
  writeFileSync(new URL('./rich-map.svg', import.meta.url), renderModuleMap(doc, { colorMode: 'heatmap' }))
  console.log('wrote rich-map.svg')
}
