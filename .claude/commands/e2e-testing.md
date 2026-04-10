---
description: Playwrightを使用したE2Eテストの環境構築・実行ガイド
globs: tests/**/*.spec.ts
alwaysApply: false
---

# E2Eテスト（Playwright）環境ガイド

## ゴール
- Playwrightを使用したブラウザ自動テスト（E2Eテスト）をプロジェクトに導入し、開発者が誰でもテストを実行・作成できる状態にする。
- 本プロジェクトの認証フローやUI仕様に基づいた確実な検証フローを確立する。

## 🔧 環境構築（初期セットアップ）

プロジェクトで初めてE2Eテストを行う場合、以下の手順が必要です。

### 1. 依存関係のインストール
プロジェクトのルートで以下のコマンドを実行し、Playwright本体とブラウザエンジンをインストールします。

```bash
# 依存パッケージのインストール
pnpm install

# ブラウザエンジンのインストール（初回のみ）
pnpm exec playwright install chromium
```

## 🚀 テストの実行方法

### 1. テストの実行
以下のコマンドでテストを実行します。`playwright.config.ts` の設定により、必要に応じて開発サーバー（pnpm run dev）が自動的に起動します。

```bash
# 全てのテストを実行
pnpm run test:e2e

# 特定のファイルを指定して実行
pnpm run test:e2e tests/investigate-settings-button.spec.ts

# UIモードで実行（ブラウザの動きを確認しながらデバッグ可能）
pnpm run test:e2e --ui
```

別のターミナルで既に開発サーバーを起動している場合（pnpm run dev）、Playwrightはその既存のサーバーを再利用します。

## 📝 テスト作成のガイドライン

### テストファイルの場所
`tests/` ディレクトリ内に `.spec.ts` 拡張子で作成してください。

### 基本テンプレート
ログインを含む基本的なテストの構造です。

```typescript
import { test, expect } from '@playwright/test';

test('基本的な操作テスト', async ({ page }) => {
  // 1. ログイン（共通処理として外出しも検討）
  await page.goto('/login');
  await page.fill('input[type="email"]', 'test-user@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // 2. 遷移待ち
  await expect(page).toHaveURL(/\/dashboard/);

  // 3. UI操作と検証
  const targetBtn = page.getByRole('button', { name: 'ターゲット' });
  await expect(targetBtn).toBeVisible();
  await targetBtn.click();

  // 4. 結果の検証
  // ...
});
```

## 🔍 トラブルシューティング

### ポート番号の不一致
`baseURL` が `http://localhost:5173` に固定されているため、開発サーバーが `5174` 等で立ち上がっている場合はテストが失敗します。
- `playwright.config.ts` を修正するか、実行時に環境変数で指定してください。

### コンソールエラーの監視
今回の「進まない」といった原因不明の挙動を調査する場合、テスト内でブラウザコンソールを監視することが有効です。

```typescript
page.on('console', msg => {
  if (msg.type() === 'error') console.log(`[Browser Error] ${msg.text()}`);
});
```

### タイムアウト
アニメーションや非同期読み込みが完了する前に操作しようとすると失敗します。
- `page.waitForTimeout(1000)` よりも、`page.waitForSelector()` や `expect(locator).toBeVisible()` を優先して使用してください。
