# Agent Loop / SSoT / PROJECT_MEMORY ハーネス設計資料

## 1. 全体思想

今回入れた仕組みは、単なる便利コマンドではなく、AIが作業を始める前に「何を根拠に判断し、どこまで進め、どこで止まるか」を固定するためのハーネスである。

中心思想は以下の3つ。

- `PROJECT_MEMORY.md` と `.cursor/rules/*.mdc` を判断根拠のSSoTにする。
- `loops/` で作業目的ごとの実行ループを定義する。
- `scripts/` と `package.json` で、そのループを機械的に評価できるようにする。

全体の流れは以下。

```text
ユーザー入力
  ↓
rules による自動判定
  ↓
PROJECT_MEMORY / rules / 既存コード / 差分を読む
  ↓
適切な Loop を選ぶ
  ↓
実装
  ↓
doctor / test:changed / 各checkで評価
  ↓
pass / warn / stop を判断
```

## 2. 立法・司法・行政の構造

`constitution.mdc` では、プロジェクト全体を3層で整理している。

| 層 | 役割 | 実体 |
|---|---|---|
| 立法 | 何が正しいか | `PROJECT_MEMORY.md`, `.cursor/rules/*.mdc`, `docs/architecture/*.mmd` |
| 司法 | 守れているか | `src/__invariants__`（存在する場合）, `scripts/check-invariant-provenance.js`, 各check |
| 行政 | どう実行するか | `workflow.mdc`, `agent-loops.mdc`, `understanding-first.mdc`, `change-contract.mdc`, scripts |

AIの要約や判断は派生情報であり、最終判断は必ず `PROJECT_MEMORY.md` / rules / architecture docs に戻す。

## 3. PROJECT_MEMORY の位置づけ

`PROJECT_MEMORY.md` はプロジェクトの長期記憶である。

主な役割:

- 絶対に壊してはいけない業務コアを記録する。
- 重要関数、不変条件、過去バグ、仕様決定を保持する。
- AIが毎回参照するべきプロジェクト固有の判断根拠になる。

ただし、AIが勝手に編集してはいけない。更新が必要な場合は、`memory-learning.mdc` に従って「追記候補」をチャットに出し、人間が判断する。

## 4. SSoT の考え方

SSoT は `Single Source of Truth` で、「同じ意味の計算・判断を複数箇所に持たない」という考え方である。

案件ごとに特に重要なSSoTは `PROJECT_MEMORY.md` に記録する。

例:

- 金額・数量計算: `src/utils/*Calculation.ts`
- 表示値の優先順位解決: `resolve*DisplayValue`
- 自動再計算: `recalc*` / `sync*`
- 確定値・手動修正保護: `locked_fields` / `manual_fields` / `override_fields` など案件で採用した契約
- 権限・状態判定: `can*` / `resolve*Status`

禁止していること:

- 別画面で同じ金額・数量・状態判定の式を再実装する。
- SSoT関数のシグネチャや戻り値をAI都合で変更する。
- 既存SSoTをコピーして別実装にする。

正しい実装は、既存SSoT関数を import して使うことである。

## 5. Agent Loop の概念

Loop は「問題を解くための実行単位」である。

各Loopは以下の4要素で構成している。

| 要素 | 意味 |
|---|---|
| Goal | 何を達成するか |
| Context | 何を読んで判断するか |
| Evaluation | 何で検証するか |
| Stop | どこで自動続行を止めるか |

重要なのは、ユーザーが「Loopで進めて」と言わなくても、`agent-loops.mdc` が入力内容から自動判定する点である。

## 6. 今回定義した Loop

| Loop | 用途 |
|---|---|
| Main Doctor Loop | 通常差分が安全かを見る |
| Bug Fix Loop | お客さんの問題文から原因調査・修正・検証まで進める |
| Regression Guard Loop | 修正後に回帰がないか確認する |
| SSoT Debt Hunter Loop | SSoT違反・技術負債を小さく解消する |
| UI Polish Loop | 見本画像・スクショ・UI意図から完成度を上げる |

`agent-loops.mdc` により、以下のように自動選択する。

```text
通常実装・差分確認 → Main Doctor Loop
不具合・問題文 → Bug Fix Loop + Regression Guard
UI改善・画像・スクショ → UI Polish Loop + Regression Guard
SSoT警告 → SSoT Debt Hunter Loop + Regression Guard
修正後確認 → Regression Guard Loop
```

## 7. UI Polish Loop の特徴

UI Polish Loop は、一発出しのUI品質を上げるためのLoopである。

特に重視するのは「コードを書く前に画像から抽出する」こと。

抽出する内容:

- レイアウト構造
- 余白
- 色
- 重心
- 視線誘導
- タイポグラフィ
- ボタン階層
- 画像やキャラクターの見切れ
- PC / モバイル差
- 禁止事項との衝突

完成判定も実装前に作る。

例:

```text
主要操作が1秒で分かる
見本画像と同じ余白・重心・視線誘導になっている
モバイルで見切れない
日本語文言だけで意味が伝わる
禁止アイコンライブラリを使っていない
```

## 8. rules 側のハーネス

`.cursor/rules/` は、AIの行動を縛る実行ハーネスである。

今回追加・強化した主なもの:

| ファイル | 役割 |
|---|---|
| `constitution.mdc` | 最上位原則。Loopで完遂することを追加 |
| `agent-loops.mdc` | 入力内容からLoopを自動選択する |
| `workflow.mdc` | 実装前にLoop判定する流れを追加 |
| `understanding-first.mdc` | 理解レポートに適用Loopを必須記載 |
| `change-contract.mdc` | 変更契約にGoal / Evaluation / Stop / 完成判定を追加 |
| `ui-design.mdc` | UI画像・見本がある場合にUI Polish Loopを自動適用 |
| `ui-design-hp-lp.mdc` | HP/LPでも参考画像から先に抽出する |

これにより、Loopは「コマンドを知っている人だけが使うもの」ではなく、AIの通常動作に組み込まれている。

## 9. scripts 側のハーネス

`scripts/` は、ルールを機械的に検証するハーネスである。

| script | 役割 |
|---|---|
| `doctor.mjs` | 複数checkをまとめて実行する総合診断 |
| `loop-evaluate.mjs` | `doctor` と `test:changed` をJSON化し、pass/warn/stopを判断 |
| `loop-discover.mjs` | 差分・Hard Boundary・SSoT負債・UI変更・ハーネス変更を発見 |
| `loop-evaluator.mjs` | 生成役とは別の独立評価役として pass/warn/stop を判定 |
| `loop-context.mjs` | 差分、評価結果、重要ルール、PROJECT_MEMORYをまとめる |
| `loop-runner.mjs` | goalごとのLoopガイドを表示し、必要な検証を提示 |
| `test-changed.mjs` | 変更ファイルから実行すべき検証コマンドを推薦 |
| `check-hard-boundaries.mjs` | 業務コア・SSoT・DB・APIなど危険変更を検知 |
| `check-ssot.cjs` | SSoT再実装パターンを検知 |
| `ssot-debt-report.mjs` | SSoT違反を領域別に整理 |
| `check-architecture-boundaries.mjs` | import方向の境界違反を検知 |
| `check-invariant-provenance.js` | `invariants.mdc` と invariant test の対応を検証 |

## 10. package.json の入口

`package.json` には、AIや人間が同じハーネスを動かせる入口を置いている。

主なコマンド:

```bash
pnpm run doctor
pnpm run loop:run
pnpm run loop:bugfix
pnpm run loop:ssot
pnpm run loop:ui
pnpm run loop:discover
pnpm run loop:evaluate
pnpm run loop:evaluator
pnpm run loop:context
pnpm run test:changed
pnpm run check:hard-boundaries
pnpm run check:ssot
pnpm run ssot:debt
pnpm run check:architecture
pnpm run check:provenance
```

用途別:

```text
通常の安全確認:
pnpm run loop:run

UI改善:
pnpm run loop:ui

不具合対応:
pnpm run loop:bugfix

SSoT負債確認:
pnpm run loop:ssot
pnpm run ssot:debt

総合診断:
pnpm run doctor

変更面別の推奨テスト:
pnpm run test:changed
```

## 11. doctor の中身

`pnpm run doctor` は総合診断である。

実行するもの:

- `check:hard-boundaries`
- `check:ssot`
- `check:architecture`
- `check:provenance`
- `test:changed`

必須チェックと警告チェックを分けている。

| check | required |
|---|---|
| Hard Boundary | warning扱い |
| SSoT再実装 | warning扱い |
| import境界 | 必須 |
| 不変条件provenance | 必須 |
| 変更面ごとの推奨検証 | warning扱い |

既存負債があるものは、いきなり開発を止めず `WARN` にしている。ただし、警告の根拠は Evidence Map に残す方針である。

## 12. loop-evaluate の判断

`loop-evaluate.mjs` は、Loopの評価をJSON化する。

判断ステータスは3つ。

| status | 意味 |
|---|---|
| `pass` | 続行可能 |
| `warn` | 続行可能だが警告理由を説明する必要あり |
| `stop` | 自動続行禁止。人間確認が必要 |

`stop` になる条件例:

- `doctor` の必須チェックが失敗。
- Hard Boundary を検知。
- Git管理外で評価不能。

`warn` になる条件例:

- SSoT既存負債。
- Hard Boundary warn-only。
- doctor が警告を出している。

## 12.1 loop-discover の発見

`loop-discover.mjs` は、ループの1ターンにおける「発見」を担当する。

発見するもの:

- Hard Boundary 変更
- SSoT再実装候補
- UI変更に対する表示確認の必要性
- ループハーネス自体の変更

通常は読み取り専用で JSON または人間向け出力を返す。必要な場合だけ、以下で状態を永続化する。

```bash
node scripts/loop-discover.mjs --write-state
```

保存先は `state/loop-findings.json`。これは会話をまたいで未解決の発見を引き継ぐためのループメモリであり、`PROJECT_MEMORY.md` の代替ではない。

## 12.2 loop-evaluator の独立評価

`loop-evaluator.mjs` は、生成役とは別の評価役として動く。

評価の姿勢:

```text
証明されるまで壊れている前提で、生成役とは別視点から評価する。
```

参照するもの:

- `loop-evaluate` の標準評価
- `loop-discover` の発見事項
- `state/loop-findings.json` の未解決状態

`stop` を返した場合、`loop-runner` は自動続行しない。`warn` の場合は、Evidence Map や報告に警告根拠を残してから続行する。

## 13. loop-context の役割

`loop-context.mjs` は、AIが判断に必要な情報をまとめるスクリプトである。

集めるもの:

- 変更ファイル
- `loop-evaluate` の結果
- `loop-discover` の発見事項
- `loop-evaluator` の独立評価
- `state/loop-findings.json` の状態
- `PROJECT_MEMORY.md`
- `safety.mdc`
- `agent-loops.mdc`
- `change-contract.mdc`
- `invariants.mdc`
- `architecture-extension.mdc`
- 各Loop goal文書
- UI関連ルール

AIが「何を読むべきか」を毎回手探りにしないためのContext生成ハーネスである。

## 14. loop-runner の役割

`loop-runner.mjs` は、Loopを人間にもAIにも読める形で実行する。

対応goal:

- `main-doctor`
- `bug-fix`
- `ssot-debt`
- `ui-polish`

現在の実装モードは `main-safe` のみ。

`main-safe` は、main上の現在差分を前提に評価するモードである。ブランチを強制せず、危険度が上がった時だけ停止・確認する。

## 15. Hard Boundary ハーネス

`check-hard-boundaries.mjs` は、触ると危険な場所を検知する。

対象例:

- `supabase/migrations/`
- `supabase/functions/`
- `api/`
- `vercel.json`
- `vite.config.ts`
- `src/lib/supabase.ts`
- `src/lib/db.ts`
- 案件固有の業務コア・SSoT（`.cursor/hard-boundaries.json` に追加）
- `package.json` の依存関係変更

Hard Boundary に触れた場合、変更契約・Evidence Map・承認理由・検証証拠が必要になる。

## 16. SSoT ハーネス

`check-ssot.cjs` は、SSoT違反を正規表現で検知する。

現在の主な検知パターン:

| ID | 内容 |
|---|---|
| `SSOT-*` | 案件で定義した計算・判定・表示優先度の再実装 |
| `SSOT-*` | 事実データから確定値を画面ごとに再計算している候補 |
| `SSOT-*` | 手動修正・確定済みデータ保護の独自判定 |

`ssot-debt-report.mjs` は、その結果を領域別に整理する。

対象領域例:

- `src/pages/*`
- `src/features/*`
- `src/components/*`
- `src/utils/*`

SSoT Debt Hunter Loop は、このレポートをもとに「1回に1領域だけ」小さく直すためのLoopである。

## 17. test:changed ハーネス

`test-changed.mjs` は、変更ファイルを見て推奨検証を出す。

例:

- 業務コア変更なら:
  - `pnpm run check:provenance`
  - `pnpm exec vitest run src/__invariants__`（存在する場合）
- `src/` や `scripts/` 変更なら:
  - `pnpm run type-check`
- UI変更なら:
  - `pnpm run test:e2e -- --list`
- rules / PROJECT_MEMORY 変更なら:
  - `pnpm run check:provenance`
- 常に追加:
  - `pnpm run check:hard-boundaries`
  - `pnpm run check:architecture`

これにより「何のテストを走らせるべきか」をAIの勘に任せない構造にしている。

## 18. Evidence Map

`change-contract.mdc` には Evidence Map を追加している。

目的は、変更の根拠と影響範囲を明示すること。

主な項目:

- Changed surface
- Entry point
- Owner boundary
- Caller
- Callee
- Sibling implementations
- Existing tests
- Current shipped behavior
- Missing evidence

特に業務コア、SSoT、DB、API、権限変更では必須である。

## 19. PRテンプレート

`.github/pull_request_template.md` には、PR時に以下を残す構造を入れている。

- 何の問題を解決するか
- なぜこの変更にしたか
- ユーザー影響
- Evidence Map
- 影響する不変条件
- 検証証拠
- Hard Boundary確認

PRを「差分の箱」ではなく「判断根拠の記録」にする意図である。

## 20. スライド構成案

スライド構成にするなら、以下の順番が分かりやすい。

1. なぜ必要か: AIが毎回同じ文脈を忘れる問題
2. 全体構造: PROJECT_MEMORY / rules / loops / scripts / package
3. 立法・司法・行政モデル
4. PROJECT_MEMORYの役割
5. SSoTの役割
6. Agent Loopの4要素
7. 自動Loop判定
8. UI Polish Loop
9. Bug Fix + Regression Guard
10. SSoT Debt Hunter
11. doctor / loop-evaluate / loop-runner の実行フロー
12. Hard Boundary / SSoT / Architecture / Provenance checks
13. package.json のコマンド一覧
14. 実際の運用例
15. 今後の発展: shadow-branchやCI強化

## 21. 要約

今回作ったものは「AIに毎回同じ安全確認・文脈確認・完成判定をさせるための実行ハーネス」である。

ルールで判断を縛り、Loopで作業を進め、scriptsで機械的に検証し、package scriptsで人間もAIも同じ手順を叩けるようにしている。
