# Supabase Auth Infinite Loading (Skeleton Screen) Troubleshooting

## Overview
ユーザーがログイン後に無限ローディング（スケルトン表示のまま進まない）に陥る問題の解決事例と、その技術的背景。
特に、既存システムからSupabase Authへの移行期に発生しやすい。

## The Problem (現象)
*   `supabase.auth.signInWithPassword` は成功している（セッションはある）。
*   しかし、画面はローディングインジケータ（`<Skeleton />`）を表示したまま停止する。
*   コンソールにエラーが出ないこともある（Promiseが解決されない、または状態更新がスキップされている）。

## Root Causes (原因)

### 1. `AuthContext` の状態管理不備 (Major)
Supabase の `onAuthStateChange` イベントリスナー内で、非同期処理（DBからのユーザープロファイル取得など）を行う際、**エラーハンドリングや完了処理が不完全なパス**が存在した。

*   **詳細:** `try-catch` ブロックがなかったり、`if (error) return;` のように早期リターンしてしまい、その後の `setLoading(false)` が実行されないケースがあった。
*   **結果:** ローディング状態 (`loading: true`) が永遠に解除されず、UIがブロックされる。

### 2. React Lifecycle との競合
非同期処理が完了する前にコンポーネントがアンマウントされたり、React.StrictModeによる二重実行で、状態更新が意図せずキャンセル・上書きされていた。

### 3. RLS (Row Level Security) の設定漏れ (Critical for Migration)
アプリのロジックは正しくても、データベース側でアクセスを拒否されているケース。

*   **詳細:** 「移行前のユーザー（`auth_user_id` が NULL のレコード）」を検索しようとした際、RLSポリシーが「認証済みユーザー（自分のID）」しか許可していないと、検索結果が空（またはエラー）になる。
*   **結果:** プロフィールが見つからず、アプリ側で「ユーザーが存在しない」等の判定になり、ログインフローが中断する（そしてローディング解除も漏れる）。

## The Solution (解決策)

### 1. 防御的コーディング (Defensive Coding)
どのような経路を通っても、**必ず** ローディングが解除されるようにする。

```typescript
// AuthContext.tsx の修正イメージ

const handleAuthEvent = async (session) => {
  try {
    if (!session) {
      // セッションなし処理
      return;
    }
    // プロフィール取得などの重い処理
    await loadUserProfile(session.user.id);
  } catch (error) {
    console.error("Auth error:", error);
    // エラー時も必要ならログアウト処理などを行う
  } finally {
    // 【重要】成功・失敗・中断に関わらず、必ずローディングを解除する
    if (isMountedRef.current) {
      setLoading(false);
    }
  }
};
```

### 2. `isMounted` Ref の活用
`useEffect` 内での非同期処理においては、処理完了時にコンポーネントがマウントされているかを必ずチェックする。

```typescript
const isMountedRef = useRef(true);

useEffect(() => {
  isMountedRef.current = true;
  return () => { isMountedRef.current = false; };
}, []);

// 状態更新前
if (isMountedRef.current) setLoading(false);
```

### 3. RLSポリシーの「穴あけ」 (Temporary Policy)
移行期間中は、Auth IDを持たないレガシーユーザーのレコードを、ログイン処理（検索）のために一時的に読み取り可能にする。

```sql
-- 移行用ポリシー: auth_user_id がまだないユーザーは参照可能にする
CREATE POLICY "Allow public read for migration" ON profiles
FOR SELECT USING (auth_user_id IS NULL);
```

## Why OpenClaw Solved It (なぜ解決できたか)
AIコーディングアシスタント（Cursor等）は「現在のファイル（コード）」に集中しがちで、**「コードは正しいが、DB設定（RLS）が間違っている」** という外部要因や、**「非同期処理の例外ルートで `finally` が抜けている」** といった構造的な欠陥を見落とすことがある。

今回は以下のアプローチで解決した：
1.  **全体俯瞰:** コードだけでなく「データ移行中である」という文脈を理解し、RLSの不備を疑った。
2.  **堅牢性重視:** エラーの原因を個別に潰すのではなく、「どんなエラーが起きてもUIをロックさせない（`finally` ブロック）」という構造変更を行った。
