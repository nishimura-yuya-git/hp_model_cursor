## 何の問題を解決するか

<!-- ユーザー報告、実画面、DB実データ、既存仕様など、変更の起点を短く書く -->

## なぜこの変更にしたか

<!-- 採用した方針と、採用しなかった案があれば理由を書く -->

## ユーザー影響

<!-- 影響する画面・操作・業務フロー。影響なしの場合も「なし」と明記する -->

## Evidence Map

- Changed surface:
- Entry point:
- Owner boundary:
- Caller:
- Callee:
- Sibling implementations:
- Existing tests:
- Current shipped behavior:
- Missing evidence:

## 影響する不変条件

<!-- 該当なしの場合も「該当なし」と明記する -->

- I-1 売上計算の数値一致チェーン:
- I-2 manual_fields による値保護:
- I-3 現金小計の保護:
- I-4 棚卸し「開始前」の手修正維持:
- I-5 中売り入力 → 精算の自動連携:
- I-6 ランキングの表示優先度:
- I-7 ステータス遷移の固定化:
- I-8 テーブル独立性:

## 検証証拠

- 実行したテスト:
- 手動確認:
- DB/画面/ユーザー報告の根拠:
- 未検証項目と理由:

## Hard Boundary 確認

<!-- 保護対象を触った場合は、承認・理由・検証を明記する -->

- `supabase/migrations/**`:
- `api/**` / `supabase/functions/**`:
- 業務コア画面:
- SSoT関数:
- `package.json` dependencies:
