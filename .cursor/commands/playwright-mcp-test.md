---
description: >-
  Playwright MCP経由でブラウザ上の機能テストを実行するコマンド（eastprideプロジェクト用）。
  「テストして」「動作確認して」「ブラウザで確認して」と言われたときに使用する。
  テストで登録・編集したデータは必ずテスト後に元の状態に戻す。
globs:
alwaysApply: false
---

# Playwright MCP テストコマンド（eastpride）

## 実行前に必ず読む

```
.cursor/skills/playwright-mcp-testing/SKILL.md
```
汎用的なテスト手順・クリーンアップルール・ツール一覧はスキルを参照。

---

## このプロジェクトの固有情報

### 開発サーバー

- **ベースURL**: `http://localhost:5173`
- **起動コマンド**: `npm run dev`
- **ターミナル確認**: `/Users/yuya/.cursor/projects/Users-yuya-JOB-workspace-eastpride/terminals/`

### MCPツールスキーマの場所

```
/Users/yuya/.cursor/projects/Users-yuya-JOB-workspace-eastpride/mcps/user-playwright/tools/
```

### 認証情報（ローカル開発用）

- ログインページ: `/login`
- メール・パスワードは環境変数または `.env.local` を参照

### 主要ページ一覧

| ページ名 | URL |
|---------|-----|
| ダッシュボード | `/dashboard` |
| シフト管理 | `/shifts` |
| 勤怠管理 | `/attendance` |
| 販売記録 | `/sales` |
| マイバッジ | `/my-badges` |
| 管理設定（バッジマスタ等） | `/admin-settings` |
| ランキング | `/ranking` |

---

## テスト実行チェックリスト

```
□ スキル（SKILL.md）を読み込んだか
□ 開発サーバーが起動しているか
□ ログイン済みか（/dashboard が表示されるか）
□ テスト前のスナップショットを取得したか
□ テストデータに [TEST] プレフィックスを付けたか
□ テスト後にクリーンアップを実施したか
□ クリーンアップ後の状態を確認したか
```

---

## プロジェクト固有の注意事項

- **Edge Function接続エラー**: ローカル環境では `check-and-grant-badges` 等のEdge Functionに接続できないコンソールエラーが出るが想定内（無視可）
- **Supabase RLS**: テストユーザーの権限によって見えるデータが異なる場合がある
- **バッジ付与**: バッジ条件の確認テストでは実際にバッジが付与される可能性があるため、テスト後に `user_badges` テーブルのテストデータを確認・削除する
