# SSoT Debt Hunter Loop

## Goal

`pnpm run check:ssot` が検知する SSoT 再実装候補を、業務領域ごとに小さく安全に解消する。

## Input

- `pnpm run check:ssot`
- `scripts/check-ssot-baseline.json`
- `.cursor/rules/architecture-extension.mdc`
- `.cursor/rules/invariants.mdc`
- `PROJECT_MEMORY.md`

## Required Steps

1. SSoT違反候補を抽出する。
2. ファイルパスから業務領域を分類する。
3. 1回の修正対象は1領域に限定する。
4. 既存SSoT関数を読み、意味を変えずに import して使えるか確認する。
5. SSoT関数のシグネチャや戻り値は勝手に変えない。
6. 修正後に Regression Guard Loop を実行する。
7. 違反が解消された場合だけ、必要に応じて `scripts/check-ssot-baseline.json` の該当既知違反を削除する。

## Stop

以下の場合は自動修正を止める。

- SSoT関数の仕様変更が必要。
- 期待値変更が必要。
- DB/RLS/業務コアなどの業務判断が必要。
- 複数領域を同時に触る必要がある。
- 手動修正・確定済みデータ保護の契約を変える必要がある。
- 不変条件テストが失敗する。

## Recommended Order

最初は表示専用・局所的で、既存SSoTを import するだけで済む箇所から始める。

1. 表示専用の派生値やフォーマット補助
2. 画面ローカルの合計・件数・状態表示
3. 保存前プレビューや集計補助
4. 確定データ・手動修正・権限に関わらないロジック
5. 契約スキーマ化やSSoT関数の利用統一

## Evaluation

標準評価は以下。

```bash
pnpm run check:ssot
pnpm run check:provenance
pnpm exec vitest run src/__invariants__ # 存在する場合
pnpm run loop:bugfix
```

## Output

- 対象領域
- 対象ファイル
- 違反ID
- 使うべきSSoT関数
- 修正方針
- 実行した検証
- 残るSSoT負債
