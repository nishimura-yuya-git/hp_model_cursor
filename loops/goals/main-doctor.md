# Main Doctor Loop

## Goal

main 上の現在差分が安全に進められる状態かを評価し、問題・不足検証・停止理由を明確にする。

## Context

- `git diff` / untracked files
- `PROJECT_MEMORY.md`
- `.cursor/rules/safety.mdc`
- `.cursor/rules/change-contract.mdc`
- `pnpm run doctor`
- `pnpm run test:changed`

## Evaluation

標準評価は以下。

```bash
pnpm run doctor
pnpm run test:changed
```

必要に応じて、`test:changed` が提示した追加コマンドを人間またはエージェントが実行する。

## Continue

以下の場合は main-safe のまま続行できる。

- Hard Boundary 変更がない、または理由と検証が明確。
- `doctor` の必須チェックが通っている。
- 警告が既存負債として説明できる。
- 推奨検証コマンドが明確。

## Stop

以下の場合は停止して人間確認へ回す。

- Hard Boundary に触れている。
- `doctor` の必須チェックが失敗している。
- 期待値の根拠がないテスト変更が必要。
- DB/RLS/業務コアなどの業務判断が必要。
- 同じ失敗が2回続く。

## Output

- status: `pass` / `warn` / `stop`
- changed files
- risk summary
- recommended commands
- stop reason
- next action
