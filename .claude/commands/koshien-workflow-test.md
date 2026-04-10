---
description: >-
  甲子園の一連業務フロー（興行日確認→シフト登録→中売り入力→記録整合性→棚卸し整合性→精算フル操作→個別保存・全体終了）を
  Playwright MCP または npx playwright test で検証するコマンド。
  「一連フローをテストして」「精算フローを確認して」「整合性チェックして」と
  言われたときに使用する。
globs:
alwaysApply: false
---

# 甲子園 一連業務フロー テストコマンド

## 🚨 絶対禁止事項

- **パスワードのリセット・変更は絶対に行わない**
- テストで変更したデータは必ずテスト後に元の状態に戻す（クリーンアップ必須）
- 本番データを削除しない（テスト専用データのみ操作）

---

## ⚠️ テスト前の必須確認（事前クリーンアップチェック）

**テスト開始前に以下のテーブルが空であることを必ず確認すること。**  
残っている場合は先にクリーンアップしてからテストを開始する。

```sql
-- 1. shift_requests が残っていないか確認
SELECT id, profile_id, status FROM shift_requests
WHERE event_day_id = (
  SELECT id FROM event_days WHERE date = '2026-03-01' AND venue = 'koshien'
);

-- 2. shifts が残っていないか確認
SELECT id, profile_id, sales_status FROM shifts
WHERE event_day_id = (
  SELECT id FROM event_days WHERE date = '2026-03-01' AND venue = 'koshien'
);

-- 3. transaction_logs が残っていないか確認
SELECT COUNT(*) FROM transaction_logs
WHERE shift_id IN (
  SELECT id FROM shifts WHERE event_day_id = (
    SELECT id FROM event_days WHERE date = '2026-03-01' AND venue = 'koshien'
  )
);

-- 4. settlements が残っていないか確認
SELECT COUNT(*) FROM settlements
WHERE shift_id IN (
  SELECT id FROM shifts WHERE event_day_id = (
    SELECT id FROM event_days WHERE date = '2026-03-01' AND venue = 'koshien'
  )
);
```

> 残っている場合は後述の「クリーンアップ手順」を先に実行すること。

---

## テストファイル一覧

| ファイル | 内容 |
|---------|------|
| `tests/koshien-full-workflow.spec.ts` | 業務フロー全体の整合性チェック（本ドキュメントの全シナリオ） |
| `tests/settlement-cash-protection.spec.ts` | 現金小計保護（管理者入力が売り子保存で上書きされないか） |

---

## 業務フロー全体像

```
STEP 1: 興行日（3/1 甲子園）が存在するか確認
  ↓
STEP 2: 西村を含む3名のシフトを登録（中売り入力に反映されるか確認）
  ↓
STEP 3: 中売り入力で各スタッフの販売数を登録
  ↓
STEP 4: 中売り記録で整合性チェック（登録数・金額が一致するか）
  ↓
STEP 5: 全体棚卸しで整合性チェック（DB売上が正しく計算されているか）
  ↓
STEP 6: 管理者側で精算の硬貨・紙幣を先に入力して個別保存
  ↓
STEP 7: 西村でログインし、キャッシュレス4種を登録して保存
  ↓
STEP 8: 管理者側で紙幣・硬貨が消えていないか確認（現金小計保護チェック）
  ↓
STEP 9: スタッフが登録したキャッシュレス・管理者が登録した現金が両方残っているか確認
  ↓
STEP 10: 全員の個別保存を実行（エラーが出ないか確認）
  ↓
STEP 10.5: 最終チェッカーが数量を手動調整 → 歩合給・能率給の自動再計算を確認
  ↓
STEP 11: 全体終了（最終確定）を実行（エラーが出ないか確認）
```

---

## 実行方法

### ローカル実行（Playwright CLI）

```bash
# 一連フロー全体（整合性チェック付き）
E2E_ADMIN_EMAIL=kazushitomoda@gmail.com \
E2E_ADMIN_PASSWORD=kazu0613 \
E2E_STAFF_EMAIL=yuuya.0205@icloud.com \
E2E_STAFF_PASSWORD=YuuYa150205 \
E2E_TEST_DATE=2026-03-01 \
npx playwright test tests/koshien-full-workflow.spec.ts --headed

# 現金小計保護テストのみ
E2E_ADMIN_EMAIL=kazushitomoda@gmail.com \
E2E_ADMIN_PASSWORD=kazu0613 \
E2E_STAFF_EMAIL=yuuya.0205@icloud.com \
E2E_STAFF_PASSWORD=YuuYa150205 \
E2E_TEST_DATE=2026-03-01 \
npx playwright test tests/settlement-cash-protection.spec.ts --headed

# 両方まとめて実行
E2E_ADMIN_EMAIL=kazushitomoda@gmail.com \
E2E_ADMIN_PASSWORD=kazu0613 \
E2E_STAFF_EMAIL=yuuya.0205@icloud.com \
E2E_STAFF_PASSWORD=YuuYa150205 \
E2E_TEST_DATE=2026-03-01 \
npx playwright test tests/koshien-full-workflow.spec.ts tests/settlement-cash-protection.spec.ts
```

### Playwright MCP 経由（Cursor エージェント）

Cursor エージェントが以下の手順でテストを実行します：

1. `browser_navigate` でログインページへ移動
2. `browser_type` でメール・パスワードを入力（**パスワードは変更しない**）
3. `browser_click` でログインボタンを押す
4. 各ページへ移動して `browser_snapshot` でUI状態を確認
5. テスト後は必ず元のデータに戻す

---

## テストシナリオ詳細

### STEP 1: 興行日確認
- **URL**: `/shifts/koshien`
- **確認項目**:
  - 2026-03-01 の甲子園興行日が存在すること
  - `event_days` テーブルに `date='2026-03-01'`, `venue='koshien'` のレコードがあること
- **整合性チェック**: 興行日がなければ以降のテストは全てスキップ

### STEP 2: シフト登録確認
- **URL**: `/shifts/koshien`
- **操作**:
  - 2026-03-01 の日付で西村を含む3名のシフトを登録・承認する
  - `shift_requests` テーブルに `status='approved'` のレコードが作成されること
  - `shifts` テーブルに対応するレコードが作成されること
- **確認項目**:
  - 西村（yuuya.0205@icloud.com）を含む3名以上のシフトが登録されていること
  - シフト登録後に `/sales-input/koshien` のスタッフ一覧に反映されること
- **整合性チェック**: シフト数が中売り入力ページのスタッフ数と一致すること
- **🚨 クリーンアップ対象**: `shift_requests`・`shifts` の両テーブルに書き込まれる（テスト後に両方削除必須）

### STEP 3: 中売り入力
- **URL**: `/sales-input/koshien`
- **操作**:
  - 日付を 2026-03-01 に設定
  - 各スタッフに販売数を入力（例: 商品A を 5個）
  - 「販売終了」ボタンで販売を終了
- **確認項目**:
  - 入力フォームが表示されること
  - 保存成功のトーストが表示されること
  - 販売終了後にステータスが変わること
- **🚨 クリーンアップ対象（重要）**:
  - `transaction_logs` テーブルに中売り入力ログが書き込まれる
  - `sales_records` テーブルに販売記録が書き込まれる
  - `shifts.sales_status` が `selling` → `sales_ended` に更新される
  - **テスト後にこれら全てを元の状態に戻すこと**

### STEP 4: 中売り記録の整合性チェック
- **URL**: `/sales-records/koshien`
- **確認項目**:
  - 2026-03-01 の記録が表示されること
  - STEP 3 で入力した販売数が記録に反映されていること
  - スタッフ名と販売数が一致すること
- **整合性チェック**: 中売り入力の合計 = 記録ページの合計

### STEP 5: 全体棚卸しの整合性チェック
- **URL**: `/inventory/koshien`
- **確認項目**:
  - 棚卸しページが表示されること
  - DB売上列が存在し、0以外の値が表示されること
  - STEP 3 の販売数から計算されたDB売上が正しいこと
- **整合性チェック**: DB売上 = 販売数 × 単価（transaction_logs の合計）

### STEP 6: 管理者が現金を先に入力
- **URL**: `/settlement/koshien`
- **操作**:
  - 日付を 2026-03-01 に設定
  - 西村の列の「紙幣」に値を入力（例: 5000）
  - 西村の列の「硬貨」に値を入力（例: 500）
  - 「個別保存」ボタンをクリック
- **確認項目**:
  - 保存成功のトーストが表示されること
  - 入力した紙幣・硬貨の値が画面に残っていること

### STEP 7: 西村がキャッシュレス4種を登録
- **URL**: `/settlement-input`
- **操作（西村アカウントでログイン）**:
  - 日付を 2026-03-01 に設定
  - PayPay: 1000 を入力
  - 交通系IC: 500 を入力
  - iD: 300 を入力
  - QUICPay: 200 を入力
  - 「入力内容を保存」ボタンをクリック
- **確認項目**:
  - 保存成功のトーストが表示されること
  - 4種のキャッシュレス合計 = 2000円

### STEP 8: 管理者側で現金小計保護を確認
- **URL**: `/settlement/koshien`（管理者でログイン）
- **確認項目**:
  - 西村の列の「紙幣」が STEP 6 で入力した値のままであること（消えていないこと）
  - 西村の列の「硬貨」が STEP 6 で入力した値のままであること（消えていないこと）
  - 現金小計 = 紙幣 + 硬貨 = 5000 + 500 = 5500 であること
- **整合性チェック**: 売り子の保存で管理者入力の現金が上書きされていないこと

### STEP 9: 全データ整合性チェック
- **URL**: `/settlement/koshien`
- **確認項目**:
  - 非現金小計 = PayPay + 交通系 + iD + QUICPay = 2000円
  - 現金小計 = 紙幣 + 硬貨 = 5500円
  - 現物合計 = 現金小計 + 非現金小計 = 7500円
  - 売上金額（DB売上）と現物合計の差異が許容範囲内であること
- **整合性チェック**: 各計算式が正しく機能していること

### STEP 10: 個別保存（全スタッフ）
- **URL**: `/settlement/koshien`
- **操作**:
  - 各スタッフの「個別保存」ボタンをクリック
- **確認項目**:
  - 全スタッフの個別保存が成功すること
  - エラートーストが表示されないこと
  - 保存後にステータスが `settlement_completed` に変わること

### STEP 10.5: 数量手動調整 → 歩合給・能率給の自動再計算チェック

> **背景**: 最終チェッカーが精算ページで各売り子の数量を手動修正するケースがある。  
> 数量を変更した際に、歩合給（`commission_pay`）と能率給（`efficiency_pay`）が  
> 給与マスタ（`commission_pay_master` / `efficiencies`）を参照して自動再計算されることを確認する。

- **URL**: `/settlement/koshien`
- **前提条件**: STEP 10 完了後（全スタッフが `精算終了` 状態）
- **操作**:
  1. いずれかのスタッフの「修正を保存」ボタンがある状態で、数量フィールドの鍵アイコン（「手動修正を有効にする」）をクリックしてロックを解除
  2. 数量を元の値から変更する（例: 5 → 7）
  3. 歩合給・能率給・売上の各フィールドが即座に再計算されることを画面上で確認
  4. 「修正を保存」ボタンをクリックして保存
- **確認項目**:
  - 数量変更後、歩合給が `commission_pay_master` の単価 × 新数量で自動更新されること
  - 数量変更後、能率給が `efficiencies` テーブルの閾値に基づいて自動更新されること
  - 数量変更後、売上金額が平均単価 × 新数量で自動更新されること
  - 歩合給・能率給・売上の `manual_fields` フラグがリセットされ、中売連動に戻ること
  - 保存後に `settlements` テーブルの `commission_pay` が再計算値で更新されていること
- **整合性チェック（SQL）**:
  ```sql
  -- 数量変更後の歩合給が commission_pay_master と整合しているか確認
  SELECT
    p.full_name,
    s.total_quantity,
    s.commission_pay AS saved_commission,
    s.efficiency_pay AS saved_efficiency,
    s.manual_fields
  FROM settlements s
  JOIN shifts sh ON s.shift_id = sh.id
  JOIN profiles p ON sh.profile_id = p.id
  JOIN event_days ed ON sh.event_day_id = ed.id
  WHERE ed.date = '2026-03-01' AND ed.venue = 'koshien'
  ORDER BY p.full_name;
  ```
- **期待値**:
  - `manual_fields` に `commission_pay` / `efficiency_pay` が含まれていないこと（数量変更で連動フラグがリセットされる）
  - `commission_pay` = `commission_pay_master` の単価合計 × 調整後数量（端数は四捨五入）
- **⚠️ 注意**: テスト後はクリーンアップ前に数量を元の値に戻してから個別保存すること（または直接クリーンアップで削除）

### STEP 11: 全体終了（最終確定）
- **URL**: `/settlement/koshien`
- **操作**:
  - 全員の個別保存完了後に「全体終了」または「最終確定（営業終了）」ボタンをクリック
- **確認項目**:
  - 全体終了が成功すること
  - エラートーストが表示されないこと
  - ステータスが `business_closed` に変わること

---

## 環境変数一覧

| 変数名 | 説明 | デフォルト |
|--------|------|----------|
| `PLAYWRIGHT_BASE_URL` | アプリのベースURL | `http://localhost:5173` |
| `E2E_ADMIN_EMAIL` | 管理者メールアドレス | `kazushitomoda@gmail.com` |
| `E2E_ADMIN_PASSWORD` | 管理者パスワード | （必須・Secrets管理） |
| `E2E_STAFF_EMAIL` | 西村のメールアドレス | `yuuya.0205@icloud.com` |
| `E2E_STAFF_PASSWORD` | 西村のパスワード | （必須・Secrets管理） |
| `E2E_TEST_DATE` | テスト対象日付（YYYY-MM-DD） | `2026-03-01` |

---

## CI（GitHub Actions）

`.github/workflows/test-koshien-full-workflow.yml` で自動実行されます。

- **トリガー**: `main` ブランチへの push / PR
- **認証情報**: GitHub Secrets から注入（パスワードはコードに書かない）
- **スモークテスト**: 認証情報なしでも実行される（ページ存在確認のみ）

---

## チェックリスト

### テスト前
```
□ 開発サーバーが起動しているか（npm run dev）
□ 環境変数が設定されているか
□ パスワードをリセット・変更していないか（絶対禁止）
□ 2026-03-01 甲子園の興行日が存在するか（事前確認）
□ shift_requests テーブルに残存データがないか確認した（事前クリーンアップチェック）
□ shifts テーブルに残存データがないか確認した（事前クリーンアップチェック）
□ transaction_logs テーブルに残存データがないか確認した（事前クリーンアップチェック）
□ settlements テーブルに残存データがないか確認した（事前クリーンアップチェック）
□ テスト前のデータ状態を記録したか
```

### テスト後（クリーンアップ）
```
□ settlements を削除したか
□ transaction_logs を削除したか
□ sales_records を削除したか
□ shifts を削除したか
□ shift_requests を削除したか ⚠️（見落とし注意：shiftsと独立して残る）
□ 全テーブルのカウントが 0 であることをSQLで確認したか
□ /sales-input/koshien の 2026-03-01 で「出勤データがありません」と表示されることを確認したか
□ /settlement/koshien の 2026-03-01 でスタッフなし・金額ゼロであることを確認したか
```

---

## 整合性チェック一覧

| チェック項目 | 期待値 | 確認方法 |
|------------|--------|---------|
| シフト数 = 中売り入力スタッフ数 | 一致 | 両ページのスタッフ数を比較 |
| 中売り入力数 = 記録ページの数 | 一致 | 入力値と記録値を比較 |
| DB売上 = transaction_logs合計 | 一致 | 棚卸しページとDB直接確認 |
| 現金小計 = 紙幣 + 硬貨 | 一致 | 精算ページの計算確認 |
| 非現金小計 = キャッシュレス合計 | 一致 | 精算ページの計算確認 |
| 現物合計 = 現金小計 + 非現金小計 | 一致 | 精算ページの計算確認 |
| 売り子保存後も管理者の現金が残る | 保護されている | 現金小計保護テスト |
| 個別保存後エラーなし | エラーなし | 保存ボタン操作確認 |
| 数量手動変更 → 歩合給が自動再計算 | commission_pay_master × 新数量 | STEP 10.5 精算ページ確認 |
| 数量手動変更 → 能率給が自動再計算 | efficiencies テーブルの閾値判定 | STEP 10.5 精算ページ確認 |
| 数量変更後の manual_fields リセット | commission_pay / efficiency_pay が除外される | DB直接確認（manual_fields列） |
| 全体終了後エラーなし | エラーなし | 全体終了ボタン操作確認 |

---

## トラブルシューティング

### カレンダーで日付が選択できない
- `input[type="date"]` が存在する場合は直接 `.fill()` で入力
- ボタン型カレンダーの場合は前月ボタンで移動してから日付ボタンをクリック

### 保存後のトーストが見つからない
- セレクタ: `[role="status"], [class*="toast"], [class*="Toast"]`
- テキスト: `保存しました`, `Success`, `成功`

### ログアウトボタンが見つからない
- サイドバーの `button[name="ログアウト"]` を使用
- モバイルの場合はヘッダーのログアウトボタンを使用

### 興行日が見つからない場合
- Supabase管理画面で `event_days` テーブルを確認
- `date='2026-03-01'` かつ `venue='koshien'` のレコードが必要
- なければ `/shifts/koshien` から手動で興行日を作成

### シフトが中売り入力に反映されない場合
- `shifts` テーブルで `is_active=true` かつ `event_day_id` が正しいか確認
- `/shifts/koshien` で対象日のシフトが承認済みか確認

---

## 🧹 クリーンアップ手順（テスト後に必ず実行）

テスト後は以下の順序で Supabase MCP（`execute_sql`）を使って削除すること。  
**削除順序を守らないと外部キー制約でエラーになる。**

```sql
-- STEP 1: settlements を削除（shifts に依存）
DELETE FROM settlements
WHERE shift_id IN (
  SELECT id FROM shifts WHERE event_day_id = (
    SELECT id FROM event_days WHERE date = '2026-03-01' AND venue = 'koshien'
  )
);

-- STEP 2: transaction_logs を削除（shifts に依存）
DELETE FROM transaction_logs
WHERE shift_id IN (
  SELECT id FROM shifts WHERE event_day_id = (
    SELECT id FROM event_days WHERE date = '2026-03-01' AND venue = 'koshien'
  )
);

-- STEP 3: sales_records を削除（shifts に依存）
DELETE FROM sales_records
WHERE shift_id IN (
  SELECT id FROM shifts WHERE event_day_id = (
    SELECT id FROM event_days WHERE date = '2026-03-01' AND venue = 'koshien'
  )
);

-- STEP 4: shifts を削除
DELETE FROM shifts
WHERE event_day_id = (
  SELECT id FROM event_days WHERE date = '2026-03-01' AND venue = 'koshien'
);

-- STEP 5: shift_requests を削除（⚠️ 今回見落としていた箇所）
-- shifts を削除しても shift_requests は独立して残るため、必ず別途削除すること
DELETE FROM shift_requests
WHERE event_day_id = (
  SELECT id FROM event_days WHERE date = '2026-03-01' AND venue = 'koshien'
);
```

### クリーンアップ後の確認

```sql
-- 全テーブルが空になっていることを確認
SELECT
  (SELECT COUNT(*) FROM shift_requests WHERE event_day_id = 'e9d4bab3-ed64-472c-9660-67e3a5b55d06') AS shift_requests_count,
  (SELECT COUNT(*) FROM shifts WHERE event_day_id = 'e9d4bab3-ed64-472c-9660-67e3a5b55d06') AS shifts_count,
  (SELECT COUNT(*) FROM transaction_logs WHERE shift_id IN (SELECT id FROM shifts WHERE event_day_id = 'e9d4bab3-ed64-472c-9660-67e3a5b55d06')) AS transaction_logs_count,
  (SELECT COUNT(*) FROM settlements WHERE shift_id IN (SELECT id FROM shifts WHERE event_day_id = 'e9d4bab3-ed64-472c-9660-67e3a5b55d06')) AS settlements_count;
-- 全て 0 であればクリーンアップ完了
```

ブラウザでも `/sales-input/koshien` の 2026-03-01 を開いて  
「**出勤データがありません**」と表示されることを目視確認すること。

### ⚠️ shift_requests を見落とすと何が起きるか

- `shifts` を削除しても `shift_requests` が残ると、中売り入力ページに「確定済 / 記録なし」のスタッフが表示され続ける
- 見た目上はシフトが残っているように見えるが、実データ（shifts）は存在しない矛盾状態になる
- 次回テスト時に重複登録エラーや表示の不整合が発生する原因となる
- **`shift_requests` は `shifts` とは独立したテーブルのため、shifts 削除時に自動では消えない**
