---
alwaysApply: true
---
## 0. サイトリンク（Sitelinks）が表示される理由（要点）

ブランド名の検索で Google のサイトリンクが表示されるのは、主に以下のシグナルが揃っているため（完全にコントロールは不可・確率を高める施策）。

- 明確なサイト構造とナビゲーション（ヘッダー/フッターに主要導線）
- 内部リンクの整合性（アンカーテキストが意味的で一貫）
- XML サイトマップと robots.txt の適正
- 構造化データ（WebSite＋SearchAction、SiteNavigationElement、BreadcrumbList、Organization/LocalBusiness）
- 主要ページのユニークなタイトル/ディスクリプション/本文
- ブランドクエリに対するサイトの関連性と信頼性（Google Business Profile 等）

本プロジェクトでも上記が満たされれば十分に表示され得る。以降のガイドをすべて満たすと、他案件でも再現性高く狙える。

---

## 1. 技術スタックと配置

- Meta制御（推奨配置）: `src/components/SEO/Meta.tsx`
- 構造化データ(JSON-LD)（推奨配置）: `src/components/SEO/JsonLd.tsx`
- 動的サイトマップ: `api/sitemap.js`（Serverless Function）
- ルーティング: React Router（`src/App.tsx`）
- robots.txt: `public/robots.txt`
- ルートHTML: `index.html`（地理情報メタ含む）
- Vercelリライト: `vercel.json`（`/sitemap.xml -> /api/sitemap.js`）

---

## 2. 既存実装（要点）

※ このリポジトリに `src/components/SEO` が無い場合は、以下「2.0 最小実装テンプレ」をそのまま追加して使用してよい（Helmet等の外部依存なし）。

### 2.0 最小実装テンプレ（Vite + React / 依存ゼロ）

```tsx

// src/components/SEO/Meta.tsx

import { useEffect } from'react'


interfaceMetaProps {

title?: string

description?: string

canonical?: string

ogType?: 'website' | 'article'

ogImage?: string

}


exportconstMeta: React.FC<MetaProps> = ({

title = 'シュシュ歯科クリニック',

description = '丁寧な説明と高度な医療技術で、質の高い歯科治療をご提供します。',

canonical,

ogType = 'website',

ogImage

}) => {

useEffect(() => {

constd = document

constset = (name: string, content: string) => {

letel = d.querySelector(`meta[name="${name}"]`) asHTMLMetaElement | null

if (!el) { el = d.createElement('meta'); el.setAttribute('name', name); d.head.appendChild(el) }

el.setAttribute('content', content)

    }

constsetProperty = (property: string, content: string) => {

letel = d.querySelector(`meta[property="${property}"]`) asHTMLMetaElement | null

if (!el) { el = d.createElement('meta'); el.setAttribute('property', property); d.head.appendChild(el) }

el.setAttribute('content', content)

    }


document.title = title

set('description', description)

consturl = canonical || window.location.origin + window.location.pathname

letlink = d.querySelector('link[rel="canonical"]') asHTMLLinkElement | null

if (!link) { link = d.createElement('link'); link.rel = 'canonical'; d.head.appendChild(link) }

link.href = url


setProperty('og:title', title)

setProperty('og:description', description)

setProperty('og:type', ogType)

setProperty('og:url', url)

if (ogImage) setProperty('og:image', ogImage)

  }, [title, description, canonical, ogType, ogImage])

returnnull

}

```

```tsx

// src/components/SEO/JsonLd.tsx

import { useEffect } from'react'


exportconstJsonLd: React.FC<{ data: Record<string, any> }> = ({ data }) => {

useEffect(() => {

constel = document.createElement('script')

el.type = 'application/ld+json'

el.text = JSON.stringify(data)

document.head.appendChild(el)

return () => { document.head.removeChild(el) }

  }, [data])

returnnull

}

```

使用（例）：ページ冒頭で

```tsx

<Metatitle="医院案内｜シュシュ歯科クリニック"description="院長紹介・医院概要など"/>

<JsonLddata={{

'@context':'https://schema.org', '@type':'BreadcrumbList',

itemListElement: [

    { '@type':'ListItem', position:1, name:'ホーム', item:location.origin + '/' },

    { '@type':'ListItem', position:2, name:'医院案内', item:location.origin + '/clinic' },

  ]

}}/>

```

### 2.1 Meta.tsx（必須メタの自動注入）

- タイトル、description、keywords、author、robots
- OG/Twitter（一式）
- canonical の自動生成（現在のURLで常に最新化）

-`<html lang="ja">` を強制

使用例（各ページのトップで呼ぶ）:

```tsx

<Metatitle="ページタイトル"description="160字以内の要約"/>

```

### 2.2 JsonLd.tsx（構造化データ）

共通:

- Organization（ロゴ/創業/代表/住所）
- WebSite（サイト内検索のSearchActionを含む）
- SiteNavigationElement（主要導線の明示）
- LocalBusiness（所在地/緯度経度/営業時間/説明/ロゴ/別名）

ページ別:

- home: BreadcrumbList（ホーム）＋Service（主要サービスなど）
- news（一覧）: CollectionPage + ItemList（記事リスト）
- article（詳細）: Article（headline/datePublished/author/publisher/mainEntityOfPage）＋パンくず

呼び出し例:

```tsx

// ホーム

<JsonLdtype="home"/>


// お知らせ一覧（newsArticles は一覧の取得データ）

<JsonLdtype="news"newsArticles={newsArticles.map(a=> ({

id:a.id, title:a.title, display_date:a.display_date, updated_at:a.updated_at

}))}/>


// 記事詳細

<JsonLdtype="article"articleData={{

title:article.title,

description:article.content.slice(0, 200),

publishedTime:article.display_date,

modifiedTime:article.updated_at,

author:'Your Company',

image:article.image_url || 'https://example.com/images/og.png'

}}/>

```

### 2.3 動的サイトマップ（重要）

- エンドポイント: `GET https://example.com/sitemap.xml`
- リライト: `vercel.json` で `/sitemap.xml -> /api/sitemap.js`
- 生成内容:
- ルート/一覧/採用/主要セクション
- Supabaseの `news_articles`（必要に応じてサイト固有のフィルタを設定）から個別記事URLを自動追加
- 環境変数対応（Vercel）:

-`SUPABASE_URL` or `VITE_SUPABASE_URL`

-`SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY`

- 静的 `public/sitemap.xml` は削除済み（動的優先のため）

補足（本リポジトリ向け実装指針）:

- サーバーレスを使わない場合は `public/sitemap.xml` を配置してもよい（自動生成スクリプト推奨）。
- サーバーレスを使う場合は以下のように実装する。

```js

// api/sitemap.js（Vercel Serverless）

exportdefaultasyncfunctionhandler(req, res) {

constorigin = process.env.SITE_ORIGIN || 'https://example.com'

constroutes = [

'/', '/clinic', '/medical', '/price', '/news',

'/medical/general-dentistry','/medical/implant-treatment','/medical/whitening',

'/medical/orthodontics','/medical/pediatric-dentistry','/medical/home-visit'

  ]

constnow = newDate().toISOString()

consturls = routes.map((p) =>`\n  <url>\n    <loc>${origin}${p}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${p==='/'?'1.0':'0.8'}</priority>\n  </url>`).join('')

constxml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`

res.setHeader('Content-Type', 'application/xml')

res.status(200).send(xml)

}

```

`vercel.json`（最優先で `/sitemap.xml` を通す）:

```json

{

"rewrites": [

    { "source": "/sitemap.xml", "destination": "/api/sitemap.js" },

    { "source": "/((?!api/).*)", "destination": "/index.html" }

  ]

}

```

### 2.4 robots.txt

-`Sitemap: https://example.com/sitemap.xml`

- 主要パスを Allow、`/api/` を Disallow

サンプル（`public/robots.txt`）:

```

User-agent: *

Allow: /

Disallow: /api/

Sitemap: https://example.com/sitemap.xml

```

### 2.5 index.html

- 地理メタ（geo.region / geo.placename / geo.position）
- OG/Twitter 既定セット

-`<link rel="sitemap" ...>` を設置

---

## 3. 新規ページ追加時のルール

1) ルーティング追加（`src/App.tsx`）
2) ページ先頭で `<Meta .../>` を必ず呼ぶ
3) ページ種別に応じて `<JsonLd .../>` を呼ぶ
4) ニュース詳細の場合は `ogType="article"`、画像があれば `ogImage` 指定
5) 一覧や詳細のURLはサイトマップでカバーされる（Newsは自動。固定ページは動的XMLに常時含め済み）

---

## 4. Google Search Console 運用

初回/変更時:

- サイトマップ送信: `https://example.com/sitemap.xml`
- URL検査: 重要な新規/更新記事URLで「インデックス登録をリクエスト」

定期確認:

- カバレッジ（インデックス状況）
- パフォーマンス（ブランド名・ニュースCTR）
- 拡張（構造化データ）

---

## 5. 検証ツール

- リッチリザルトテスト: https://search.google.com/test/rich-results
- Schema Markup Validator: https://validator.schema.org/
- URL検査（GSC）: インデックス状況と再クロール要求

---

## 6. ローカル/ブランド検索対策

1) LocalBusiness/Organization スキーマで住所を完全記述（郵便番号/都道府県/市区/番地/階）
2) index.html の地理情報メタ維持
3) Google Business Profile 登録推奨

- 会社名、住所（例: 「〒000-0000 東京都千代田区〇〇1-1-1 〇〇ビル 1F」）
- 営業時間（平日10:00-19:00）
- カテゴリ: コンサル/マーケティングサービス

---

## 7. 変更手順（チェックリスト）

### 新しいニュースを公開

- [ ] Supabaseに記事追加（必要に応じてサイト固有のフィルタを設定）
- [ ] 一覧/トップに自動反映（実装済み）
- [ ] サイトマップは自動でURL生成
- [ ] 重要記事はGSCでURL検査→インデックス登録リクエスト

### 固定ページを追加

- [ ] ルーティング追加
- [ ] `<Meta />` と `<JsonLd />` を追加
- [ ] 必要なら `api/sitemap.js` に固定URLを追加（現在の雛形で主要セクションはカバー済み）

### デプロイ後

- [ ] `https://example.com/sitemap.xml` をブラウザで確認
- [ ] 主要URLの `rel=canonical` 正常確認
- [ ] リッチリザルトテストで構造化データOK
- [ ] GSCにサイトマップ送信/再送信

---

## 8. トラブルシューティング

表示されない/古い:

- 動的サイトマップが返っているか確認（静的XMLが残っていないか）
- GSCで「検出－インデックス未登録」→ URL検査 → 再クロール
- 重要記事は内部リンク（トップ/一覧）から辿れる状態に

メタの不整合:

- 二重`<title>`/`<meta>`がないか確認（`Meta.tsx` が上書き）
- canonical が正しく現在URLになっているか

構造化データエラー:

-`JsonLd.tsx` に必要フィールドを渡しているか

- Articleの `headline/datePublished` が空でないか

---

## 9. よくある質問（FAQ）

Q. 会社名検索で住所はどう出す？

- LocalBusiness/Organization の住所を完全記載＋Google Business Profile の登録/認証。

Q. ニュースが検索に出ない？

- サイトマップと `Article/CollectionPage` スキーマは実装済。公開後にGSCで個別URLのインデックス登録をリクエスト。

Q. サイトリンクは？

-`WebSite`（SearchAction付き）と `SiteNavigationElement` を実装し、内部リンクと明確なナビを維持。

---

## 12. サイトリンク最適化チェックリスト（完全版）

### A. 構造化データ（最重要）

- WebSite（必須）: `SearchAction` を含める（ブランド検索時の Sitelinks Search Box 対応）
- SiteNavigationElement（必須）: ヘッダー/フッターの主要導線を明示
- BreadcrumbList（推奨）: すべての主要ページ
- Organization/LocalBusiness（推奨）: 住所/電話/同一性（sameAs）

実装例:

```tsx

<JsonLddata={{

'@context':'https://schema.org',

'@type':'WebSite',

name:'シュシュ歯科クリニック',

url:location.origin,

potentialAction: {

'@type':'SearchAction',

target:`${location.origin}/?q={search_term_string}`,

'query-input':'required name=search_term_string'

  }

}}/>


<JsonLddata={{

'@context':'https://schema.org', '@type':'SiteNavigationElement',

name: ['ホーム','医院案内','診療案内','料金','お知らせ'],

url: [

`${location.origin}/`,

`${location.origin}/clinic`,

`${location.origin}/medical`,

`${location.origin}/price`,

`${location.origin}/news`

  ]

}}/>

```

### B. 画面実装

- ヘッダー/フッターに主要導線（本リポジトリは `Header.tsx`/`Footer.tsx` でOK）
- アンカーテキストは意味的（例: 「医院案内」「診療案内」「料金表」）
- 各ページにユニークなタイトル/description（`<Meta />`を使用）
- カノニカルの明示（動的生成）

### C. クロール設定

- XML サイトマップ（動的 or 静的）
- robots.txt でサイトマップを宣言
- GSC にプロパティ登録 → サイトマップ送信 → 重要URLは URL検査>インデックス登録リクエスト

### D. 品質シグナル

- ページごとの固有コンテンツ量/内部リンク/読みやすさ
- 住所・電話・診療時間の明記（LocalBusiness）
- Google Business Profile の整備（名称/住所/カテゴリ）

---

## 13. よく使う JSON-LD ひな型（抜粋）

```tsx

// Organization + LocalBusiness

<JsonLddata={{

'@context':'https://schema.org', '@type':'LocalBusiness',

name:'シュシュ歯科クリニック',

url:location.origin,

telephone:'06-6762-0513',

image:`${location.origin}/logo.png`,

address: {

'@type':'PostalAddress',

postalCode:'〒542-0012', addressRegion:'大阪府', addressLocality:'大阪市', streetAddress:'中央区谷町9-2-14'

  }

}}/>

```

---

## 14. まとめ（サイトリンク出現の鍵）

- 構造化データ（WebSite/SearchAction, SiteNavigationElement, Breadcrumb）
- 明確なナビと内部リンク（Header/Footer の導線は現状OK）
- XML サイトマップ + robots.txt + GSC 提出
- 各ページの固有タイトル/description/本文

以上を満たせば、本案件でも他案件でもサイトリンクの出現確率を最大化できる。

---

## 10. 実装差分（要点まとめ）

- 動的サイトマップAPI: `/api/sitemap.js`（Supabase連携、個別ニュースURL生成）

-`vercel.json` リライト: `/sitemap.xml` -> `/api/sitemap.js`

- 静的 `public/sitemap.xml` を削除（競合防止）

-`JsonLd.tsx` に Organization/LocalBusiness/WebSite/Navigation/Service/CollectionPage/Article を実装

-`Meta.tsx` でOG/Twitter/robots/canonicalを自動注入

-`index.html` に地理情報メタ/OG/Twitter 既定値

---

## 11. 運用ポリシー

- すべてのページに `<Meta />` と適切な `<JsonLd />` を必須
- 住所/営業時間等の変更は `JsonLd.tsx`（LocalBusiness/Organization）と `CompanyInfo.tsx` を同時更新
- 重要更新時はGSCのインデックス登録を必ず実行
