---
description: >-
  新機能のCI（GitHub Actions）テストを構築するコマンド。
  「現在正常に動いている状態を正解として固定化（CI化）」する考え方で、
  壊れてはいけないコア機能を自動テストで守る。
globs:
alwaysApply: false
---

# CI テスト構築コマンド

## 基本思想

> **「今の動いている状態が正解。それを壊れたら即検知できる仕組みを作る」**

新機能を追加するたびに他の処理が壊れる「回帰バグ」を防ぐために、
**ビジネス上絶対に壊れてはいけないコア機能**をCIで自動監視する。

---

## 🚨 最重要ルール：テストはモック方式で書く

### ✅ モック方式（必須）
```typescript
// Supabaseへの実通信を行わず、偽データで差し替える
await page.addInitScript((profile) => {
  localStorage.setItem('ep_session', JSON.stringify(profile));
}, adminProfile);

await page.route('**/rest/v1/**', async (route) => {
  // 全APIリクエストをモックで返す
  await route.fulfill({ status: 200, body: JSON.stringify(mockData) });
});
```

### ❌ 実ログイン方式（CI上で使用禁止）
```typescript
// NG: CIサーバーにパスワードがないため必ず失敗する
await page.goto('/login');
await page.fill('input[type="email"]', credentials.email);
await page.fill('input[type="password"]', credentials.password); // ← CI上でNULLになる
```

**理由**: CI（GitHub Actions）サーバーには `.env` ファイルが存在しないため、
実際のSupabaseへのログインは必ず失敗する。
モック方式なら環境に依存せず、どこでも安定して動作する。

---

## 📋 CIテスト構築の手順

### Step 1. 対象機能の選定（優先順位）

| 優先度 | 対象 | 理由 |
|---|---|---|
| 🔴 最優先 | 売上・精算・給与計算 | 金額が絡む・データ破損が致命的 |
| 🔴 最優先 | 権限制御（RLS） | 見えてはいけないデータが見える |
| 🟡 次点 | 中売り入力・記録 | 現場運用の中核 |
| 🟡 次点 | シフト管理 | スタッフ全員に影響 |
| 🟢 後回し | UI表示・フォーム | 目で確認できる |

### Step 2. テストファイルの作成

**ファイル命名規則**: `tests/{機能名}-{テスト内容}.spec.ts`

**モック方式テンプレート（コピペ用）**:

```typescript
import { expect, test, type Page, type Route } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';

// 日付ヘルパー
const getToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// JSONレスポンスのヘルパー
const fulfillJson = async (route: Route, payload: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
};

// モックセットアップ（ログイン不要）
const setupMocks = async (page: Page) => {
  const adminProfile = {
    id: 1,
    email: 'kazushitomoda@gmail.com',
    role: '管理者',
    is_active: true,
    last_name: '友田',
    first_name: '和志',
    photo_url: null,
  };

  // セッションをlocalStorageに直接セット（ログイン画面をスキップ）
  await page.addInitScript((profile) => {
    localStorage.setItem('ep_session', JSON.stringify(profile));
    localStorage.setItem('ep_permissions', JSON.stringify([]));
  }, adminProfile);

  // Supabase APIをすべてモックで差し替え
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (method === 'HEAD') {
      await route.fulfill({ status: 200, headers: { 'content-range': '0-0/0' } });
      return;
    }

    // ここに各テーブルのモックを追加
    // if (pathname.endsWith('/テーブル名')) { await fulfillJson(route, モックデータ); return; }

    await fulfillJson(route, []);
  });
};

test.describe('{機能名}のE2Eテスト', () => {
  test('{テスト内容}', async ({ page }) => {
    test.setTimeout(60000);

    await setupMocks(page);
    await page.goto(`${BASE_URL}/{パス}`);
    await page.waitForLoadState('networkidle');

    // ここにテストの検証ロジックを書く
    await expect(page.getByText('期待するテキスト')).toBeVisible();
  });
});
```

### Step 3. GitHub Actions ワークフローの作成・更新

**ワークフローは機能領域ごとに分離する（汎用ルール）**

| ワークフローファイル | 対象 |
|---|---|
| `.github/workflows/test-sales-input.yml` | 中売り入力（甲子園） |
| `.github/workflows/test-settlement.yml` | 〆精算（甲子園、`tests/settlement/`） |
| `.github/workflows/test-koshien-records-inventory.yml` | 中売記録・棚卸し（甲子園、`tests/koshien-sales-records/` + `tests/koshien-inventory/`） |

- **中売り**にテストを足す → `test-sales-input.yml` の `npx playwright test` にファイルを追記
- **精算**にテストを足す → **`tests/settlement/` に新規 `.spec.ts` を1本追加**（**1動作=1ファイル**推奨）。`test-settlement.yml` は `tests/settlement/` ディレクトリごと実行するため **yml の編集は基本不要**
- **中売記録・棚卸し（甲子園）**にテストを足す → 各ディレクトリに spec を追加し、`test-koshien-records-inventory.yml` は **ディレクトリ指定のまま**なら **yml 変更不要**

精算の共通モック: `tests/settlement/helpers/koshien-rest-mock.ts` の `setupKoshienSettlementRestMock(page)` を利用する。

中売記録の共通モック: `tests/koshien-sales-records/helpers/rest-mock.ts` の `setupKoshienSalesRecordsRestMock(page)`。

棚卸しの共通モック: `tests/koshien-inventory/helpers/rest-mock.ts` の `setupKoshienInventoryRestMock(page)`。

```yaml
# test-sales-input.yml の追記例
- run: npx playwright test tests/sales-input-xxx.spec.ts tests/sales-input-yyy.spec.ts
```

### Step 4. ローカルで動作確認してからPush

```bash
# 対象テストだけ実行して確認
npx playwright test tests/{テストファイル}.spec.ts

# 中売りCI相当
npx playwright test tests/sales-input-batch-registration.spec.ts tests/sales-input-category-toggle.spec.ts

# 精算CI相当（ディレクトリまとめて）
npx playwright test tests/settlement/

# 中売記録・棚卸し（甲子園）CI相当
npx playwright test tests/koshien-sales-records/ tests/koshien-inventory/
```

---

## 📁 現在のCI対象テスト一覧

| ファイル | 対象機能 | 方式 |
|---|---|---|
| `tests/sales-input-batch-registration.spec.ts` | 甲子園 中売り一括登録 | モック |
| `tests/sales-input-category-toggle.spec.ts` | 甲子園 商品カテゴリトグル | モック |
| `tests/settlement/koshien-page-loads.spec.ts` | 〆精算 ページ表示 | モック |
| `tests/settlement/koshien-vendor-column-visible.spec.ts` | 〆精算 売り子列ヘッダー | モック |
| `tests/settlement/koshien-individual-save-button-visible.spec.ts` | 〆精算 個別保存ボタン | モック |
| `tests/koshien-sales-records/koshien-page-loads.spec.ts` | 中売記録（甲子園）ページ表示 | モック |
| `tests/koshien-inventory/koshien-page-loads.spec.ts` | 全体棚卸し（甲子園）ページ表示 | モック |

---

## 🔄 新機能追加時のワークフロー

```
新機能の実装依頼
  ↓
1. 実装前にテストコードを先に書く（モック方式で）
2. テストを確認・承認してから実装開始
3. 実装後にローカルでテスト実行 → 全通過を確認
4. .github/workflows/test-*.yml にテストファイルを追加
5. mainにPush → CIが自動実行 → ✅ 全通過でマージ
```

---

## 🚨 よくあるエラーと対処法

### エラー1: `getByText('本日出勤')` が見つからない
**原因**: モックのセッション設定が正しくない、またはAPIモックが足りない
**対処**: `page.addInitScript` でセッションが正しくセットされているか確認。
`ep_session` の `role` が `'管理者'` になっているか確認。

### エラー2: `data-testid="xxx"` が見つからない
**原因**: 実装側でtestidが変更されたか、そもそも設定されていない
**対処**: `src/pages/` 内で `data-testid` を検索して正しい値を確認。
```bash
grep -r 'data-testid="xxx"' src/
```

### エラー3: ログインページから遷移しない
**原因**: 実ログイン方式になっている（モック方式に変更が必要）
**対処**: `page.addInitScript` でlocalStorageに直接セッションをセットする方式に変更。

### エラー4: CI上でのみ失敗する（ローカルでは通る）
**原因**: 環境変数（`.env`）に依存している処理がある
**対処**: 全APIをモックで差し替えているか確認。実ログインが混入していないか確認。

---

## 💡 テスト設計の考え方

### 「何をテストすべきか」の判断基準

```
壊れたら困る度 × 壊れやすい度 = テストの優先度
```

**テストすべきこと（仕様の核心）**:
- 「2名選択して一括登録したら、2名分のデータが保存される」
- 「カテゴリを切り替えたら、そのカテゴリの商品だけ表示される」
- 「精算確定後は売り子が数値を変更できない」

**テストしなくていいこと（実装の詳細）**:
- 「商品が全部で12個表示される」（DBデータが変われば壊れる）
- 「ボタンの色が blue-600 である」（デザイン変更で壊れる）
- 「APIが3回呼ばれる」（実装変更で壊れる）
