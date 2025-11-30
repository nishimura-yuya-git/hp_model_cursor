
# Supabase CMS機能実装マニュアル

Supabaseを使用した簡易CMS（ブログ・お知らせ機能）を実装するための手順書です。
テナントID (`VITE_TENANT_ID`) を変更することで、複数のプロジェクトで同じ `news_articles` テーブルを共有・管理できます。

## 🚨 実装前の必須確認（AIエージェント用指示）

**この手順を実行する前に、必ずユーザーに以下の質問を行ってください。**

> 「CMS機能を実装します。対象の `VITE_TENANT_ID` （テナントID）を教えてください。」

ユーザーからテナントIDの回答があるまで、以下の実装ステップに進まないでください。
回答が得られたら、そのIDを使用して `.env` ファイルの設定を行ってください。

---

## 1. 環境変数の設定

`.env` ファイルに以下の変数を設定します。
`VITE_TENANT_ID` はユーザーから聴取した値を設定してください。

```env
VITE_SUPABASE_URL=https://jujkuqbzrfrseiusszag.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1amt1cWJ6cmZyc2VpdXNzemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxOTI0NzIsImV4cCI6MjA2NDc2ODQ3Mn0.CU_le8mDYVn2bQet9vJXPm3_RIMWy9wdn-y-Dv9Qrmc
VITE_TENANT_ID=<ユーザーから指定されたID>
```

## 2. 必要なパッケージのインストール

```bash
npm install @supabase/supabase-js
```

## 3. 型定義の作成

`src/types/news.types.ts` を作成します。

```typescript
/**
 * ニュース記事の型定義
 */
export interface NewsArticle {
  id: number;
  tenant_id: number;
  title: string;
  content: string;
  image_url: string | null;
  display_date: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}
```

## 4. Supabaseクライアント設定

`src/lib/supabase.ts` を作成します。

```typescript
import { createClient } from '@supabase/supabase-js';

/**
 * Supabaseクライアント設定
 * 環境変数から接続情報を取得
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase環境変数が設定されていません。ブログ機能は無効化されます。');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

/**
 * テナントID
 * .envのVITE_TENANT_IDを使用
 */
export const TENANT_ID = Number(import.meta.env.VITE_TENANT_ID) || 0;
```

## 5. データ取得フックの実装

`src/hooks/useNewsArticles.ts` を作成します。

```typescript
import { useState, useEffect } from 'react';
import { supabase, TENANT_ID } from '../lib/supabase';
import type { NewsArticle } from '../types/news.types';

/**
 * ニュース記事を取得するカスタムフック
 * @param limit 取得する記事数（デフォルト: 5）
 */
export const useNewsArticles = (limit: number = 5) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: supabaseError } = await supabase
          .from('news_articles')
          .select('*')
          .eq('tenant_id', TENANT_ID)
          .order('display_date', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit);

        if (supabaseError) {
          throw new Error(supabaseError.message);
        }

        setArticles(data || []);
      } catch (err) {
        console.error('ニュース記事の取得に失敗しました:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [limit]);

  return { articles, loading, error };
};

export default useNewsArticles;
```

## 6. 実装例 (BlogSection)

コンポーネントでの使用例です。

```tsx
import React from 'react';
import { useNewsArticles } from '../../hooks/useNewsArticles';

// 日付フォーマット関数
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

export const BlogSection: React.FC = () => {
  const { articles, loading, error } = useNewsArticles(3);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <section>
      <h2>BLOG</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {articles.map((article) => (
          <article key={article.id}>
            {article.image_url && (
              <img src={article.image_url} alt={article.title} className="w-full aspect-[3/2] object-cover" />
            )}
            <time>{formatDate(article.display_date)}</time>
            <h3>{article.title}</h3>
            <p>{article.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
};
```
