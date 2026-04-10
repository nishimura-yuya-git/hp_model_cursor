# プロジェクトルール（Claude Code用）

実装前に必ず `.claude/rules/` の全ファイルを確認すること。

## 参照順序（厳守）
1. `.claude/rules/workflow.md` - 開発手順書（最初に必読）
2. `.claude/rules/vibe-coding.md` - 効率化とMVP開発の哲学
3. `.claude/rules/core.md` - 基本原則・技術スタック・禁止ライブラリ
4. `.claude/rules/ui-design.md` - デザインシステム・禁止事項
5. `.claude/rules/architecture.md` - アーキテクチャ設計
6. `.claude/rules/security.md` - セキュリティルール
7. `.claude/rules/seo.md` - SEO実装ガイド

@.claude/rules/workflow.md
@.claude/rules/vibe-coding.md
@.claude/rules/core.md
@.claude/rules/ui-design.md
@.claude/rules/architecture.md
@.claude/rules/security.md
@.claude/rules/seo.md

---

## 利用可能なカスタムコマンド（`.claude/commands/`）

### コマンド
| `/コマンド名` | 概要 |
|-------------|------|
| `/conversation-summary` | 会話ログを `doc/materials/` に要約 |
| `/report-to-client` | クライアント向け開発報告文を生成 |
| `/resend-email` | Resendメール実装ガイド |
| `/supabase-cms` | Supabase CMS実装手順 |

### スキル
| `/コマンド名` | 概要 |
|-------------|------|
| `/skeleton-loading` | スケルトンローディング実装 |
| `/supabase-auth-troubleshooting` | Supabase Auth無限ローディング解決 |
| `/supabase-backup` | データベースバックアップ手順 |
| `/supabase-edge-function-file-upload` | Edge Functionファイルアップロード認証パターン |
