# Regression Guard Loop

## Goal

修正が目的の問題を解消していること、かつ既存の重要仕様を壊していないことを確認する。

## Context

- 変更ファイル
- `pnpm run doctor`
- `pnpm run test:changed`
- 近接テスト
- `src/__invariants__`（存在する場合）
- 関連E2E
- 必要なスクリーンショットまたは手動確認結果

## Required Checks

標準チェックは以下。

```bash
pnpm run loop:run
pnpm run test:changed
```

業務コアを触った場合は以下を追加する。`src/__invariants__` が存在しない案件では、不変条件テストの実行は省略理由を報告する。

```bash
pnpm run check:provenance
pnpm exec vitest run src/__invariants__
```

UIを触った場合は以下を検討する。

```bash
pnpm run type-check
pnpm run test:e2e -- --list
```

## Pass

以下を満たす場合、回帰ガードは通過扱いにできる。

- Main Doctor Loop が `pass` または説明可能な `warn`。
- 変更面に対応するテストまたは手動確認がある。
- Hard Boundary に触れた場合、Evidence Map と承認理由がある。
- テスト期待値をAI都合で変えていない。

## Stop

以下の場合は停止する。

- `doctor` の必須チェック失敗。
- 不変条件テスト失敗。
- Hard Boundary 変更の説明不足。
- 期待値根拠がない。
- 修正対象外の画面・計算・DB挙動が変わった可能性がある。

## Output

- pass / warn / stop
- 実行した検証
- 省略した検証と理由
- 残リスク
- 次の確認ポイント
