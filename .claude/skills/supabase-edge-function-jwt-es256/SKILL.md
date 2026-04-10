# Supabase Edge Function: ES256 JWT で 401 Invalid JWT が発生する問題

## 問題の概要

`supabase.functions.invoke()` で Edge Function を呼び出すと、ブラウザコンソールに以下のエラーが出る。

```
lshgarccrawcfcgeceis.supabase.co/functions/v1/[function-name]:1
Failed to load resource: the server responded with a status of 401 ()
```

フロントエンドの `supabase.functions.invoke` は正常に動作し、セッションも有効（`hasSession: true`）なのにエラーになる。

---

## 原因

Supabase の新しい Auth 設定では JWT の署名アルゴリズムが **ES256**（楕円曲線・非対称鍵）になっている場合がある。

Edge Function のゲートウェイは `verify_jwt = true`（デフォルト）のとき **HS256**（対称鍵）の JWT のみを正しく検証できる。そのため ES256 JWT を受け取ると「Invalid JWT」として 401 を返す。

**見分け方：** JWT のヘッダーをデコードすると `"alg":"ES256"` になっている。

```
eyJhbGciOiJFUzI1NiIs...
         ↑ base64 decode → {"alg":"ES256",...}
```

これは Supabase の DB アクセス（RLS）では問題なく動作するが、Edge Function のゲートウェイ検証では弾かれる。

---

## デバッグで判明した手順

1. `supabase.functions.invoke` のエラーオブジェクト `error.context` をレスポンスボディとして読む
2. `{"code":401,"message":"Invalid JWT"}` が返っていれば、ゲートウェイレベルの JWT 検証失敗が確定

```typescript
// エラーボディの取得方法
let errorBody: unknown = null;
if (error && (error as any).context) {
  try { errorBody = await (error as any).context.json?.(); } catch { /* ignore */ }
}
console.log(errorBody); // → {"code":401,"message":"Invalid JWT"}
```

---

## 解決策

### 方法1：`--no-verify-jwt` フラグで再デプロイ（推奨）

```bash
npx supabase functions deploy [function-name] --no-verify-jwt
```

ゲートウェイレベルの JWT 検証をスキップし、関数コード内で `supabaseAnon.auth.getUser()` を使って認証する。

**メリット：** シンプルで確実。関数コード内で認証を自前管理できる。  
**デメリット：** ゲートウェイの自動保護がなくなるため、関数コード内の認証チェックを必ず実装すること。

```typescript
// Edge Function 内での認証チェック（--no-verify-jwt 時は必須）
const authHeader = req.headers.get("Authorization");
if (!authHeader) return json(401, { ok: false, error: "Authorizationヘッダーがありません。" });

const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } },
});

const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
if (authError || !user) {
  return json(401, { ok: false, error: `認証に失敗しました: ${authError?.message}` });
}
```

### 方法2：フロントエンドで Authorization ヘッダーを明示指定

```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) return; // セッションなしは事前チェック

const { data, error } = await supabase.functions.invoke('function-name', {
  body: { ... },
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});
```

`supabase.functions.invoke` は自動でトークンを付与するが、明示指定することでセッション取得タイミングの問題も防げる。

---

## 関連する落とし穴

### `supabase.functions.invoke` のエラーオブジェクト

エラーが非 2xx レスポンスの場合、`error.message` は常に `"Edge Function returned a non-2xx status code"` となり詳細がわからない。実際のエラー内容は `error.context` から取得する必要がある。

```typescript
const { data, error } = await supabase.functions.invoke('...');
if (error) {
  // ❌ これだと詳細が見えない
  console.error(error.message); // "Edge Function returned a non-2xx status code"

  // ✅ これで実際のエラーが見える
  const body = await (error as any).context?.json?.();
  console.error(body); // {"code":401,"message":"Invalid JWT"} など
}
```

---

## このプロジェクトでの適用箇所

- **Edge Function**: `supabase/functions/invite-applicant/index.ts`
- **フロントエンド**: `src/services/applicantService.ts` の `inviteApplicantToMypage()`
- **デプロイコマンド**: `npx supabase functions deploy invite-applicant --no-verify-jwt`
