# ts-archi-viz

TypeScript の型を **色・形・シンボル・アイコン** で視覚化し、「見ただけで何が実装されているか」を掴めるようにする実験的ツールです。最終的には npm ライブラリ → VSCode 拡張を目指しています。

> ステータス: 実験・プロトタイプ段階。視覚言語と中核（抽出→IR→描画）を固めている最中です。

## コンセプト

各視覚チャネルは「意味の軸」をちょうど1つだけ持ちます（1チャネル1意味）。

| チャネル | 意味 |
|---|---|
| **アイコン** | 原子（プリミティブ）の正体（`string`/`number`/`boolean`…） |
| **形** | 集約構造の種類（下表） |
| **色** | 深度（寒色＝浅い → 暖色＝深い）。`indent`（自分の深さ）/`heatmap`（配下の最深）で切替 |
| **シンボル** | 演算子・修飾（union / intersection / optional / readonly。危険 `any/never` も） |
| **アニメ** | 動詞（変換）への上乗せ。webview のみ・静的で意味は完結 |

### 形（器のシルエット）

| 種類 | 形 |
|---|---|
| interface | コンセント（差し込み口＝契約） |
| object literal | 波括弧 `{ }`・上下=実線 |
| class | 波括弧 `{ }`・底面=破線（可変） |
| array | 角括弧 `[ ]`・底面=破線（可変長） |
| tuple | 角括弧 `[ ]`・底面=実線（固定長） |
| union | 重なり矩形 |
| enum | 点の並び `・・・` |

副言語: **底面 実線＝固定／破線＝可変、天面 実線＝interface 契約あり**。

### 2つのスケール（連続セマンティックズーム）

- **micro**: 1つの型を「層（開示）×深度（色）×ネスト」でズーム（層1 名前 → 層2 構成アイコン → 層3 ラベル → 層4 ネスト展開）。
- **macro**: モジュールの型サーフェスを円パッキングで俯瞰（形＝種類・大きさ＝重み・線＝参照）。
- マップのノードをクリック → その型の層ビューへズーム、で macro ↔ micro が一本の操作軸でつながります。

## アーキテクチャ

```
.ts ソース → 抽出(ts.TypeChecker) → 正規化IR(JSON) → レンダラ(SVG / HTML)
```

抽出と描画を分離し、IR を介して疎結合にしています（同じ IR から静的SVG・インタラクティブ表示・モジュールマップを生成）。

- `src/ir.ts` — 型IR と ModuleDoc
- `src/extract.ts` / `src/extractModule.ts` — Compiler API による抽出
- `src/shapes.ts` — 種類ごとの器シルエットと小アイコン
- `src/renderSvg.ts` — 静的SVGカード
- `src/renderInteractive.ts` — 層ズーム（インタラクティブ）
- `src/renderModuleMap.ts` — モジュールマップ
- `src/renderExplorer.ts` — macro↔micro 連続ズーム＋色モード切替

## 使い方（開発）

ランタイムは [Bun](https://bun.sh) です。

```sh
bun test                      # テスト
bun examples/explorer.ts      # explorer.html を生成（macro↔micro）
bun examples/extract-user.ts  # 実ソースから型カードを生成
bun examples/module-map.ts    # モジュールマップを生成
```

生成された `.svg` / `.html` はブラウザで開けます。

## ライセンス

MIT
