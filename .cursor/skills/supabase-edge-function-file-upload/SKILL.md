---
name: supabase-edge-function-file-upload
description: Supabase Edge FunctionへFormDataでファイルをアップロードする際の401 Unauthorized エラーを解決するためのパターン。supabase.functions.invokeでFormDataを送信する場合、またはSupabase Edge Functionで認証エラーが発生した場合に使用する。
---

# Supabase Edge Function ファイルアップロード 認証パターン

## 問題の根本原因

`supabase.functions.invoke()` に `FormData` を `body` として渡す場合、**Supabase SDKはユーザーのJWTを自動的に転送しない**（匿名キーが使われる）。

さらに、Edge Functionの `verify_jwt: true`（デフォルト）は、ゲートウェイレベルでJWTを検証するため、関数コードが実行される前に `401` を返してしまう。

## 解決策：フロントエンド側

`supabase.functions.invoke()` を呼ぶ前に `getSession()` でセッションを取得し、`Authorization` ヘッダーを **明示的に** 渡す。

```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) throw new Error('セッション切れ');

const form = new FormData();
form.append('targetProfileId', String(profileId));
form.append('file', file);

const { data, error } = await supabase.functions.invoke('your-function', {
  body: form,
  headers: {
    Authorization: `Bearer ${session.access_token}`, // 必須
  },
});
```

## 解決策：Edge Function側

### 認証パターン（推奨）

```typescript
// ❌ 非推奨：service_role keyクライアントでgetUser(token)を呼ぶ
const supabaseAdmin = createClient(url, SERVICE_ROLE_KEY);
const { data: { user } } = await supabaseAdmin.auth.getUser(token); // 失敗することがある

// ✅ 推奨：anon keyクライアント + global headers + getUser()（引数なし）
const authHeader = req.headers.get("Authorization");
const supabaseClient = createClient(url, ANON_KEY, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user }, error: authError } = await supabaseClient.auth.getUser(); // 引数なし
```

### デプロイ時の設定

```bash
# verify_jwt: false にすることでゲートウェイでの早期拒否を防ぐ
# 関数内部で独自に認証を行う
supabase functions deploy your-function --no-verify-jwt
```

> `verify_jwt: false` にしても関数コード内で `auth.getUser()` を呼ぶため、認証は確実に行われる。

## Edge Function の完全テンプレート

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  // ✅ 推奨パターン
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
  }

  // DB/Storage操作にはservice_role keyを使う
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // FormDataの取得
  const formData = await req.formData();
  const file = formData.get("file") as File;

  // ... 処理 ...
});
```

## チェックリスト

- [ ] フロントエンドで `getSession()` → `session.access_token` を取得しているか
- [ ] `supabase.functions.invoke` の `headers` に `Authorization: Bearer ${token}` を渡しているか
- [ ] `new FormData()` を初期化してから `form.append()` しているか
- [ ] Edge Functionが `verify_jwt: false` でデプロイされているか（`--no-verify-jwt`）
- [ ] Edge Function内で `anon key client + global headers + getUser()` パターンを使っているか
- [ ] DB/Storage操作は `service_role key` クライアントで行っているか
