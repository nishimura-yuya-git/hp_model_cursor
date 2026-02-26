# 🗄️ Supabase データベースバックアップ（ダンプ）

このスキルは、Supabase リモートデータベースから SQL 形式のダンプ（バックアップ）を取得するための手順とベストプラクティスをまとめたものです。

## 📋 基本概要
- **目的**: データベース全体の構造（スキーマ）とデータを `.sql` ファイルとして保存する
- **推奨ツール**: `pg_dump`（Docker が不要で軽量）
- **前提**: PostgreSQL 17 （Supabase の最新版に対応）

## 🚀 バックアップ手順

### 1. 接続情報の確認
ダッシュボードの **Settings → Database** から以下の情報を取得します。
- **Host**: `db.upxdwuzisclcekxmpaoa.supabase.co`
- **User**: `postgres`
- **Database**: `postgres`

### 2. pg_dump（PostgreSQL 17 用）の実行
バージョン不一致（server 17 vs client 14など）を防ぐため、最新版を明示的に指定して実行します。

```bash
# Mac (Homebrew) でインストールされたパスを指定
/opt/homebrew/opt/postgresql@17/bin/pg_dump -h db.upxdwuzisclcekxmpaoa.supabase.co -U postgres -d postgres > backups/full_backup_$(date +%Y%m%d).sql
```

### 3. ファイルの保護（.gitignore）
バックアップには機密情報が含まれる可能性があるため、Git 管理から除外することを強く推奨します。

```bash
# .gitignore に backups/ フォルダを追加
backups/
```

## 🔧 トラブルシューティング

### Q1: `pg_dump: error: server version mismatch` と出る
- **原因**: サーバー（Supabase）の Postgres バージョンが、ローカルの `pg_dump` より新しいためです。
- **解決**: `brew install postgresql@17` で最新ツールをインストールし、実行時に絶対パス（`/opt/homebrew/opt/postgresql@17/bin/pg_dump`）を指定してください。

### Q2: パスワードを毎回入力したくない
- **解決**: `.pgpass` ファイルを作成するか、一時的に環境変数 `PGPASSWORD` を使用します（セキュリティに注意）。

## 🚨 注意事項
- **セキュリティ**: 生成されたバックアップファイルは機密情報です。公開リポジトリにアップロードしたり、アクセス権の緩い場所に置かないでください。
- **定期バックアップ**: 手動だけでなく、GitHub Actions 等で自動化することも検討してください。
