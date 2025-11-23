---
description: 

globs: 

alwaysApply: false
---
# 📧 Resend メール実装マニュアル - 動作するコード（最新版）

## 🎯 概要

このマニュアルでは、Resendサービスを使用したメール送信機能の完全な実装方法を説明します。

お問い合わせフォーム、自動返信メール、管理者通知など、実用的なメール機能を構築できます。

**迷惑メール対策とメールヘッダー最適化を含む、本番環境で実際に使用できる実装**です。

## 📁 ファイル構成

```

project/

├── api/

│   └── resend/

│       └── emails.js          # Vercel Serverless Function（本番環境用）

├── dev-api-server.js           # 開発環境用APIサーバー（ローカル開発時のみ）

├── src/

│   ├── utils/

│   │   └── resendApi.ts       # フロントエンド用API

│   ├── pages/

│   │   └── Contact/

│   │       └── Contact.tsx    # お問い合わせフォームページ

│   └── hooks/

│       └── useContactForm.ts  # カスタムフック（オプション）

├── vercel.json                # Vercel設定

├── vite.config.ts             # Vite設定（プロキシ設定含む）

└── .env.local                 # 環境変数

```

## 🔧 1. 環境変数設定

### .env.local

```bash

# Resend API設定

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx

VITE_RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx


# メール設定（プロジェクト固有の値に変更）

VITE_EMAIL_SENDER=noreply@yourdomain.com

VITE_ADMIN_EMAIL=admin@yourdomain.com

VITE_REPLY_TO_EMAIL=support@yourdomain.com


# 会社情報（プロジェクト固有の値に変更）

VITE_COMPANY_NAME=YourCompanyName

VITE_COMPANY_URL=https://yourdomain.com


# 送信者名（オプション）

VITE_SENDER_NAME=YourCompanyName

```

## 🚀 2. Vercel Serverless Function（本番環境用）

### api/resend/emails.js

```javascript

"use strict";


// @ts-nocheck


// Vercel Serverless Functions用のResend APIプロキシ

// Vercelの最新Node.jsランタイムでは標準のfetchが利用可能


/**

 * 迷惑メールに分類されないようにメール送信を最適化したResendプロキシAPI

 * - SPFレコードとDKIMサポートを促進

 * - メール送信時のヘッダー情報を適切に設定

 * 

 * 【迷惑メールに分類される原因と対策】

 * 1. スパムフィルターで引っかかりやすい言葉の使用

 *    ×: 「無料」「特別オファー」「今すぐ申し込み」

 *    〇: 「ご応募ありがとうございます」「お問い合わせ内容を確認しました」

 * 

 * 2. 過度に装飾されたHTMLの使用

 *    ×: 大量の画像、派手な色使い、過剰なフォント変更

 *    〇: シンプルなレイアウト、適切な余白、読みやすいフォント

 * 

 * 3. 送信者情報の不一致

 *    ×: From欄とReply-To欄の不一致、ドメイン不一致

 *    〇: 一貫した送信者情報、企業ドメインの使用

 * 

 * 4. テキスト版がない

 *    ×: HTMLのみのメール

 *    〇: HTML版とプレーンテキスト版の両方を用意

 */


exportdefaultasync (req, res) => {

// デバッグログの出力

console.log('サーバーレス関数が呼び出されました');

console.log('環境変数の状態:', {

hasResendApiKey:!!process.env.RESEND_API_KEY,

hasViteResendApiKey:!!process.env.VITE_RESEND_API_KEY,

nodeEnv:process.env.NODE_ENV

  });


// CORS設定を行う

res.setHeader('Access-Control-Allow-Credentials', true);

res.setHeader('Access-Control-Allow-Origin', '*');

res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');

res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');


// プリフライトリクエストの処理

if (req.method==='OPTIONS') {

res.status(200).end();

return;

  }


// POSTメソッド以外は許可しない

if (req.method!=='POST') {

res.status(405).json({ error:'Method not allowed' });

return;

  }


// APIキーを取得

constapiKey=process.env.RESEND_API_KEY||process.env.VITE_RESEND_API_KEY;

if (!apiKey) {

console.error('Resend API Keyが設定されていません');

returnres.status(500).json({ error:'API key not configured' });

  }


try {

// リクエストボディの情報をログ出力

console.log('リクエストボディ概要:', {

hasBody:!!req.body,

hasFrom:req.body&&!!req.body.from,

hasTo:req.body&&!!req.body.to,

hasSubject:req.body&&!!req.body.subject

    });


// リクエストボディを取得

const { from, to, subject, html, text, reply_to } =req.body;


// 必須パラメータのチェック

if (!from||!to||!subject|| (!html&&!text)) {

console.error('必須パラメータが不足しています:', { from, to, subject });

returnres.status(400).json({ error:'Missing required parameters' });

    }


// 迷惑メールフィルタを回避するために送信者の表示名を最適化

// 送信者名が含まれていない場合は「会社名 <メール>」の形式に統一

letoptimizedFrom=from;

if (from.indexOf('<') ===-1&&from.indexOf('@') !==-1) {

// 送信者名が指定されていないので、会社名を追加

constcompanyName=process.env.VITE_COMPANY_NAME||process.env.VITE_SENDER_NAME||'Your Company';

optimizedFrom=`${companyName} <${from}>`;

    }


// 迷惑メール対策のために件名を最適化

// 【】や！などの記号の多用を避け、シンプルに

letoptimizedSubject=subject;

if (subject.includes('無料') ||subject.includes('特別') ||subject.includes('お得')) {

// スパムフィルタに引っかかりやすい単語が含まれている場合は警告をログに出力

console.warn('件名に迷惑メールフィルタに引っかかりやすい単語が含まれています:', subject);

    }


// メール送信用のパラメータ

constemailParams= {

from:optimizedFrom,

to,

subject:optimizedSubject,

reply_to:reply_to||from, // 返信先が指定されていない場合は送信者と同じに

    };


// テキストとHTML両方を設定してマルチパートメールに（必須）

if (html) emailParams.html=html;

if (text) {

emailParams.text=text;

    } elseif (html) {

// HTMLからプレーンテキスト版を自動生成（テキスト版がない場合は迷惑メールとみなされやすい）

emailParams.text=html

        .replace(/<br\s*\/?>/gi, '\n')

        .replace(/<p[^>]*>/gi, '\n')

        .replace(/<li[^>]*>/gi, '\n- ')

        .replace(/<\/li>/gi, '')

        .replace(/<\/p>/gi, '\n')

        .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)') // リンクを「テキスト (URL)」形式に

        .replace(/<[^>]*>/g, '')

        .replace(/\n{3,}/g, '\n\n') // 連続する改行を最大2つに

        .trim();

    }


// メールヘッダー情報を強化（デリバリー率向上のために重要）

emailParams.headers= {

// 一意のメッセージID（必須）

'X-Entity-Ref-ID':`resend-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,


// 配信停止リンク（迷惑メール対策として重要）

'List-Unsubscribe':`<mailto:${reply_to || from}>`,


// バルクメールであることを明示（透明性のために重要）

'Precedence':'bulk',


// 自動返信を抑制

'X-Auto-Response-Suppress':'OOF, AutoReply',


// メールクライアントの返信先設定

'Reply-To':reply_to||from,


// メール優先度（通常）

'Importance':'normal',


// メールの種類（トランザクション）

'X-Message-Type':'transactional',


// SPF/DKIM/DMARC対応を明示

'X-AuthSource':'Resend.com'

    };


console.log('Resend APIリクエスト送信前');


// Resend APIに転送

constresendResponse=awaitfetch('https://api.resend.com/emails', {

method:'POST',

headers: {

'Content-Type':'application/json',

'Authorization':`Bearer ${apiKey}`

      },

body:JSON.stringify(emailParams)

    });


console.log('Resend API レスポンスステータス:', resendResponse.status);


// テキストデータを取得

constresponseText=awaitresendResponse.text();

console.log('Resend API レスポンス:', responseText.substring(0, 200)); // 最初の200文字だけログに出力


// JSONとしてパース

letdata;

try {

data=JSON.parse(responseText);

    } catch (error) {

console.error('レスポンスのJSONパースに失敗:', error);

returnres.status(500).json({

error:'Invalid JSON response from Resend API',

responseText:responseText.substring(0, 200)

      });

    }


// APIからのレスポンスをそのまま返す

if (!resendResponse.ok) {

console.error('Resend API エラー:', data);

returnres.status(resendResponse.status).json(data);

    }


console.log('メール送信成功:', data);

returnres.status(200).json(data);


  } catch (error) {

console.error('メール送信中のエラー:', error);

returnres.status(500).json({ 

error:error.message,

stack:error.stack

    });

  }

};

```

## 🔧 2-1. 開発環境用APIサーバー（ローカル開発時のみ）

### ⚠️ 重要な問題と解決方法

**問題：**

- Viteの開発サーバー（`npm run dev`）では、`api/`ディレクトリのServerless Functionが動作しない

-`/api/resend/emails`へのリクエストが404エラーになる

- 開発環境でメール送信機能をテストできない

**解決方法：**

開発用の簡易APIサーバーを作成し、Viteのプロキシ設定で `/api`リクエストを転送する

### dev-api-server.js

```javascript

// 開発環境用の簡易APIサーバー

// Viteのプロキシ経由で動作します


importexpressfrom'express';

importcorsfrom'cors';

importdotenvfrom'dotenv';


// 環境変数を読み込み

dotenv.config({ path:'.env.local' });


constapp=express();

constPORT=3000;


// CORS設定

app.use(cors({

origin:'http://localhost:5173',

credentials: true

}));


// JSONボディパーサー

app.use(express.json());


// Resend APIプロキシエンドポイント

app.post('/api/resend/emails', async (req, res) => {

try {

constapiKey=process.env.VITE_RESEND_API_KEY||process.env.RESEND_API_KEY;


if (!apiKey) {

console.error('Resend API Keyが設定されていません');

returnres.status(500).json({ error:'API key not configured' });

    }


const { from, to, subject, html, text, reply_to } =req.body;


// 必須パラメータのチェック

if (!from||!to||!subject|| (!html&&!text)) {

returnres.status(400).json({ error:'Missing required parameters' });

    }


// 送信者名の最適化

letoptimizedFrom=from;

if (from.indexOf('<') ===-1&&from.indexOf('@') !==-1) {

constcompanyName=process.env.VITE_COMPANY_NAME||process.env.VITE_SENDER_NAME||'Your Company';

optimizedFrom=`${companyName} <${from}>`;

    }


// メールパラメータ

constemailParams= {

from:optimizedFrom,

to,

subject,

reply_to:reply_to||from,

    };


if (html) emailParams.html=html;

if (text) {

emailParams.text=text;

    } elseif (html) {

emailParams.text=html

        .replace(/<br\s*\/?>/gi, '\n')

        .replace(/<p[^>]*>/gi, '\n')

        .replace(/<li[^>]*>/gi, '\n- ')

        .replace(/<\/li>/gi, '')

        .replace(/<\/p>/gi, '\n')

        .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)') // リンクを「テキスト (URL)」形式に

        .replace(/<[^>]*>/g, '')

        .replace(/\n{3,}/g, '\n\n')

        .trim();

    }


// Resend APIにリクエスト（標準のfetchを使用）

constresendResponse=awaitfetch('https://api.resend.com/emails', {

method:'POST',

headers: {

'Content-Type':'application/json',

'Authorization':`Bearer ${apiKey}`

      },

body:JSON.stringify(emailParams)

    });


constresponseText=awaitresendResponse.text();

letdata;


try {

data=JSON.parse(responseText);

    } catch (error) {

returnres.status(500).json({

error:'Invalid JSON response from Resend API',

responseText:responseText.substring(0, 200)

      });

    }


if (!resendResponse.ok) {

returnres.status(resendResponse.status).json(data);

    }


returnres.status(200).json(data);


  } catch (error) {

console.error('メール送信中のエラー:', error);

returnres.status(500).json({ 

error:error.message,

stack:error.stack

    });

  }

});


app.listen(PORT, () => {

console.log(`開発用APIサーバーが起動しました: http://localhost:${PORT}`);

console.log(`APIエンドポイント: http://localhost:${PORT}/api/resend/emails`);

});

```

### vite.config.ts（プロキシ設定追加）

```typescript

import { defineConfig } from'vite'

importreactfrom'@vitejs/plugin-react'


// https://vitejs.dev/config/

exportdefaultdefineConfig({

plugins:[react()],

optimizeDeps: {

exclude:['lucide-react'],

  },

server: {

proxy: {

'/api': {

target:'http://localhost:3000',

changeOrigin: true,

configure: (proxy, _options) => {

proxy.on('error', (err, _req, _res) => {

console.log('プロキシエラー:', err);

          });

        },

      },

    },

  },

})

```

## 🎯 3. フロントエンド API ユーティリティ

### src/utils/resendApi.ts

```typescript

// メール設定

constEMAIL_CONFIG= {

SENDER:import.meta.env.VITE_EMAIL_SENDER||'noreply@yourdomain.com',

SENDER_NAME:import.meta.env.VITE_SENDER_NAME||import.meta.env.VITE_COMPANY_NAME||'Your Company',

ADMIN:import.meta.env.VITE_ADMIN_EMAIL||'admin@yourdomain.com',

REPLY_TO:import.meta.env.VITE_REPLY_TO_EMAIL||'support@yourdomain.com',

COMPANY_NAME:import.meta.env.VITE_COMPANY_NAME||'Your Company',

COMPANY_URL:import.meta.env.VITE_COMPANY_URL||'https://yourdomain.com',

};


/**

 * メール送信関数 - プロキシを使用してCORS問題を回避

 * 迷惑メールフィルターに引っかからないよう最適化

 */

constsendEmail=async (params: {

from:string;

to:string;

subject:string;

html:string;

text?:string; // プレーンテキスト版（オプション）

reply_to?:string; // 返信先アドレス

}) => {

try {

// マルチパートメール用にプレーンテキスト版がない場合、HTMLから生成

if (!params.text&&params.html) {

// HTMLからテキストへの変換を改善（より高品質なプレーンテキスト版）

params.text=params.html

        .replace(/<br\s*\/?>/gi, '\n')

        .replace(/<p[^>]*>/gi, '\n')

        .replace(/<li[^>]*>/gi, '\n- ')

        .replace(/<\/li>/gi, '')

        .replace(/<\/p>/gi, '\n')

        .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)') // リンクを「テキスト (URL)」形式に

        .replace(/<[^>]*>/g, '')

        .replace(/\n{3,}/g, '\n\n') // 連続する改行を最大2つに

        .trim();

    }


// 返信先が指定されていない場合、デフォルトの返信先を使用

if (!params.reply_to) {

params.reply_to=EMAIL_CONFIG.REPLY_TO;

    }


// 送信者名が含まれていない場合は「会社名 <メール>」の形式に統一

// これにより迷惑メール判定を回避

letoptimizedFrom=params.from;

if (params.from.indexOf('<') ===-1&&params.from.indexOf('@') !==-1) {

optimizedFrom=`${EMAIL_CONFIG.SENDER_NAME} <${params.from}>`;

    }


// 件名に特定のキーワードがあれば注意喚起

if (params.subject.includes('無料') ||params.subject.includes('特別') ||params.subject.includes('キャンペーン')) {

console.warn('件名に迷惑メールフィルタに引っかかりやすい単語が含まれています:', params.subject);

    }


// メールヘッダーの最適化

constoptimizedParams= {

...params,

from:optimizedFrom,

reply_to:params.reply_to,

    };


// サーバーエンドポイントのパスとURLの組み立て

// 開発環境でも本番環境でも、同じエンドポイントを使用

// 開発環境ではVercel CLI（vercel dev）を使用することで、Serverless Functionが動作します

constbaseUrl=window.location.origin;

constapiEndpoint=`${baseUrl}/api/resend/emails`;


// デバッグ情報

console.log(`メール送信リクエスト:`, {

to:params.to,

subject:params.subject,

hasHtml:!!params.html,

hasText:!!params.text,

replyTo:params.reply_to

    });

console.log(`送信先エンドポイント: ${apiEndpoint}`);


// APIにリクエストを送信

constresponse=awaitfetch(apiEndpoint, {

method:'POST',

headers: {

'Content-Type':'application/json'

      },

body:JSON.stringify(optimizedParams)

    });


// レスポンステキストを取得

constresponseText=awaitresponse.text();


// responseTextが空でないか確認

if (!responseText||responseText.trim() ==='') {

console.error('サーバーからの応答が空です');

thrownewError('空のレスポンスを受け取りました');

    }


// JSONとしてパースを試みる

letresult;

try {

result=JSON.parse(responseText);

    } catch (error) {

console.error('サーバーからの応答がJSONではありません:', responseText);

thrownewError(`サーバーからの不正な応答: ${responseText.substring(0, 100)}`);

    }


if (!response.ok) {

console.error('メール送信APIエラーレスポンス:', result);

thrownewError(`メール送信に失敗しました: ${JSON.stringify(result)}`);

    }


returnresult;

  } catch (error) {

console.error('メール送信中にエラーが発生しました:', error);

throwerror;

  }

};


// お問い合わせフォーム用メール送信

exportconstsendContactEmail=async ({

name,

email,

company,

phone,

subject,

message

}: {

name:string;

email:string;

company?:string;

phone?:string;

subject?:string;

message:string;

}) => {

try {

// お問い合わせ内容の日本語ラベル（オプション）

constsubjectLabels: { [key:string]:string } = {

'service':'サービスについて',

'demo':'デモ・資料請求',

'price':'料金について',

'support':'サポート・技術的なお問い合わせ',

'other':'その他'

    };


constsubjectLabel=subject&&subjectLabels[subject]?subjectLabels[subject]: (subject||'お問い合わせ');


// お問い合わせ者へのプレーンテキスト版

constplainTextToUser=`

お問い合わせを受け付けました


${name} 様


この度は、${EMAIL_CONFIG.COMPANY_NAME}へのお問い合わせありがとうございます。


以下の内容でお問い合わせを受け付けました：


- お問い合わせ内容: ${subjectLabel}

${company?`- 会社名・事務所名: ${company}`:''}

${phone?`- 電話番号: ${phone}`:''}


お問い合わせ内容を確認の上、3営業日以内に担当者よりご連絡いたします。


何かご不明な点がございましたら、お気軽にこのメールにご返信ください。


--


${EMAIL_CONFIG.COMPANY_NAME}

お問い合わせ窓口

${EMAIL_CONFIG.REPLY_TO}

    `;


// お問い合わせ者への自動返信メール

awaitsendEmail({

from:EMAIL_CONFIG.SENDER,

to:email, // お問い合わせ者本人に送信

reply_to:EMAIL_CONFIG.REPLY_TO, // 返信先設定

subject:`【${EMAIL_CONFIG.COMPANY_NAME}】お問い合わせありがとうございます`,

text:plainTextToUser, // プレーンテキスト版を追加

html:`

        <div style="font-family: 'Poppins', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Meiryo', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

          <h2 style="color: #1e293b; font-size: 24px; font-weight: 600; margin-bottom: 20px;">お問い合わせを受け付けました</h2>


          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">${name} 様</p>


          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">この度は、${EMAIL_CONFIG.COMPANY_NAME}へのお問い合わせありがとうございます。</p>


          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">以下の内容でお問い合わせを受け付けました：</p>


          <ul style="color: #334155; font-size: 16px; line-height: 1.8; margin-bottom: 20px; padding-left: 20px;">

            <li>お問い合わせ内容: ${subjectLabel}</li>

${company?`<li>会社名・事務所名: ${company}</li>`:''}

${phone?`<li>電話番号: ${phone}</li>`:''}

          </ul>


          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">お問い合わせ内容を確認の上、3営業日以内に担当者よりご連絡いたします。</p>


          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">何かご不明な点がございましたら、お気軽にこのメールにご返信ください。</p>


          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">

            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">

${EMAIL_CONFIG.COMPANY_NAME}<br>

              お問い合わせ窓口<br>

              <a href="mailto:${EMAIL_CONFIG.REPLY_TO}" style="color: #06b6d4; text-decoration: none;">${EMAIL_CONFIG.REPLY_TO}</a>

            </p>

          </div>

        </div>

      `,

    });


// 管理者へのプレーンテキスト版

constplainTextToAdmin=`

【お問い合わせ】新しいお問い合わせがありました


氏名: ${name}

メール: ${email}

${company?`会社名・事務所名: ${company}`:''}

${phone?`電話番号: ${phone}`:''}

お問い合わせ内容: ${subjectLabel}


メッセージ:

${message}


--


※このメールは自動送信されています。お問い合わせ者へのご連絡は3営業日以内にお願いいたします。

返信先（お問い合わせ者のメール）: ${email}

    `;


// 管理者への通知メール

constadminContent=`

      <div style="font-family: 'Poppins', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Meiryo', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

        <h2 style="color: #1e293b; font-size: 24px; font-weight: 600; margin-bottom: 20px;">新しいお問い合わせがありました</h2>


        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">

          <tr>

            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155; font-weight: 600;">項目</th>

            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155; font-weight: 600;">内容</th>

          </tr>

          <tr>

            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">氏名</td>

            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">${name}</td>

          </tr>

          <tr>

            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">メール</td>

            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">${email}</td>

          </tr>

${company?`

          <tr>

            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">会社名・事務所名</td>

            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">${company}</td>

          </tr>

          `:''}

${phone?`

          <tr>

            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">電話番号</td>

            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">${phone}</td>

          </tr>

          `:''}

          <tr>

            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">お問い合わせ内容</td>

            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">${subjectLabel}</td>

          </tr>

        </table>


        <h3 style="color: #1e293b; font-size: 18px; font-weight: 600; margin-bottom: 12px;">メッセージ</h3>

        <div style="padding: 15px; background-color: #f8fafc; border-radius: 5px; margin-bottom: 20px;">

          <p style="color: #334155; font-size: 16px; line-height: 1.6; white-space: pre-line; margin: 0;">${message}</p>

        </div>

      </div>

    `;


awaitsendEmail({

from:EMAIL_CONFIG.SENDER,

to:EMAIL_CONFIG.ADMIN, // 管理者に送信

reply_to:email, // 返信先はお問い合わせ者に設定

subject:'【お問い合わせ】新しいお問い合わせがありました',

text:plainTextToAdmin, // プレーンテキスト版を追加

html:adminContent+`

        <div style="font-family: 'Poppins', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Meiryo', sans-serif; max-width: 600px; margin: 0 auto; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">

          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 8px;">※このメールは自動送信されています。お問い合わせ者へのご連絡は3営業日以内にお願いいたします。</p>

          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">返信先（お問い合わせ者のメール）: <a href="mailto:${email}" style="color: #06b6d4; text-decoration: none;">${email}</a></p>

        </div>

      `,

    });


return {

success: true,

message:'お問い合わせを受け付けました。確認メールを送信しました。'

    };


  } catch (error) {

console.error('メール送信エラー:', error);

return {

success: false,

message:'メール送信に失敗しました。時間をおいて再度お試しください。'

    };

  }

};


/**

 * カスタムメール送信（汎用）

 */

exportconstsendCustomEmail=async ({

to,

subject,

html,

text,

replyTo

}: {

to:string;

subject:string;

html:string;

text?:string;

replyTo?:string;

}) => {

returnawaitsendEmail({

from:EMAIL_CONFIG.SENDER,

to,

subject,

html,

text,

reply_to:replyTo||EMAIL_CONFIG.REPLY_TO

  });

};


/**

 * ニュースレター送信

 */

exportconstsendNewsletterEmail=async ({

to,

subject,

content,

unsubscribeUrl

}: {

to:string;

subject:string;

content:string;

unsubscribeUrl?:string;

}) => {

consthtml=`

    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">

      <!-- ヘッダー -->

      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">

        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 300;">

${EMAIL_CONFIG.COMPANY_NAME}

        </h1>

        <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9;">

          Newsletter

        </p>

      </div>


      <!-- コンテンツ -->

      <div style="padding: 40px 30px;">

${content}

      </div>


      <!-- フッター -->

      <div style="background-color: #f8f9fa; padding: 30px; text-align: center;">

        <p style="color: #666666; margin: 0; font-size: 14px;">

${EMAIL_CONFIG.COMPANY_NAME}

        </p>

${unsubscribeUrl?`

        <p style="color: #999999; margin: 15px 0 0 0; font-size: 12px;">

          <a href="${unsubscribeUrl}" style="color: #999999;">配信停止</a>

        </p>

        `:''}

      </div>

    </div>

  `;


returnawaitsendEmail({

from:EMAIL_CONFIG.SENDER,

to,

subject,

html,

reply_to:EMAIL_CONFIG.REPLY_TO

  });

};

```

## 🎨 4. React コンポーネント（お問い合わせフォーム例）

### src/pages/Contact/Contact.tsx（実装例）

```typescript

importReact, { useState } from'react';

import { sendContactEmail } from'../../utils/resendApi';


exportconstContact:React.FC= () => {

const [formData, setFormData] =useState({

name:'',

email:'',

company:'',

phone:'',

subject:'',

message:''

  });


const [isSubmitting, setIsSubmitting] =useState(false);

const [submitStatus, setSubmitStatus] =useState<'idle'|'success'|'error'>('idle');

const [submitMessage, setSubmitMessage] =useState('');


consthandleChange= (e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => {

setFormData({

...formData,

[e.target.name]:e.target.value

    });

  };


consthandleSubmit=async (e:React.FormEvent) => {

e.preventDefault();

setIsSubmitting(true);

setSubmitStatus('idle');

setSubmitMessage('');


try {

constresult=awaitsendContactEmail({

name:formData.name,

email:formData.email,

company:formData.company,

phone:formData.phone,

subject:formData.subject,

message:formData.message

      });


if (result.success) {

setSubmitStatus('success');

setSubmitMessage(result.message);

// フォームをリセット

setFormData({

name:'',

email:'',

company:'',

phone:'',

subject:'',

message:''

        });

      } else {

setSubmitStatus('error');

setSubmitMessage(result.message||'エラーが発生しました。時間をおいて再度お試しください。');

      }

    } catch (error) {

console.error('お問い合わせフォーム送信エラー:', error);

setSubmitStatus('error');

setSubmitMessage('エラーが発生しました。時間をおいて再度お試しください。');

    } finally {

setIsSubmitting(false);

    }

  };


return (

<divclassName="min-h-screen bg-white">

<divclassName="max-w-4xl mx-auto px-4 py-16">

<h1className="text-4xl font-bold mb-8">お問い合わせ</h1>


<formonSubmit={handleSubmit} className="space-y-6">

          {/* お名前 */}

          <div>

<labelhtmlFor="name"className="block text-sm font-medium text-gray-700 mb-2">

お名前<spanclassName="text-red-500">*</span>

</label>

<input

type="text"

id="name"

name="name"

value={formData.name}

onChange={handleChange}

required

className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"

/>

</div>


          {/* メールアドレス */}

          <div>

<labelhtmlFor="email"className="block text-sm font-medium text-gray-700 mb-2">

メールアドレス<spanclassName="text-red-500">*</span>

</label>

<input

type="email"

id="email"

name="email"

value={formData.email}

onChange={handleChange}

required

className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"

/>

</div>


          {/* 会社名・事務所名 */}

          <div>

<labelhtmlFor="company"className="block text-sm font-medium text-gray-700 mb-2">

会社名・事務所名

</label>

<input

type="text"

id="company"

name="company"

value={formData.company}

onChange={handleChange}

className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"

/>

</div>


          {/* 電話番号 */}

          <div>

<labelhtmlFor="phone"className="block text-sm font-medium text-gray-700 mb-2">

電話番号

</label>

<input

type="tel"

id="phone"

name="phone"

value={formData.phone}

onChange={handleChange}

className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"

/>

</div>


          {/* お問い合わせ内容 */}

          <div>

<labelhtmlFor="subject"className="block text-sm font-medium text-gray-700 mb-2">

お問い合わせ内容<spanclassName="text-red-500">*</span>

</label>

<select

id="subject"

name="subject"

value={formData.subject}

onChange={handleChange}

required

className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white"

>

<optionvalue="">選択してください</option>

<optionvalue="service">サービスについて</option>

<optionvalue="demo">デモ・資料請求</option>

<optionvalue="price">料金について</option>

<optionvalue="support">サポート・技術的なお問い合わせ</option>

<optionvalue="other">その他</option>

</select>

</div>


          {/* メッセージ */}

          <div>

<labelhtmlFor="message"className="block text-sm font-medium text-gray-700 mb-2">

メッセージ<spanclassName="text-red-500">*</span>

</label>

<textarea

id="message"

name="message"

value={formData.message}

onChange={handleChange}

required

rows={8}

className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all resize-none"

/>

</div>


          {/* 送信ステータスメッセージ */}

          {submitStatus === 'success' && (

            <divclassName="p-4 rounded-lg bg-green-50 text-green-700 border border-green-200">

              <p>{submitMessage || 'お問い合わせが完了しました。確認メールをお送りしましたのでご確認ください。'}</p>

            </div>

          )}


          {submitStatus === 'error' && (

            <divclassName="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">

              <p>{submitMessage || 'エラーが発生しました。時間をおいて再度お試しください。'}</p>

            </div>

          )}


          {/* 送信ボタン */}

<divclassName="pt-4">

<button

type="submit"

disabled={isSubmitting}

className="w-full px-8 py-4 bg-cyan-500 text-white font-semibold text-base rounded-full hover:bg-cyan-600 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"

>

              {isSubmitting ? '送信中...' : '送信する'}

</button>

</div>

</form>

</div>

</div>

  );

};

```

## ⚙️ 5. Vercel設定

### vercel.json

```json

{

"rewrites": [

    {

"source": "/sitemap.xml",

"destination": "/api/sitemap.js"

    },

    {

"source": "/api/(.*)",

"destination": "/api/$1"

    },

    {

"source": "/(.*)",

"destination": "/index.html"

    }

  ],

"headers": [

    {

"source": "/api/resend/(.*)",

"headers": [

        {

"key": "Access-Control-Allow-Origin",

"value": "*"

        },

        {

"key": "Access-Control-Allow-Methods", 

"value": "GET, POST, PUT, DELETE, OPTIONS"

        },

        {

"key": "Access-Control-Allow-Headers",

"value": "Content-Type, Authorization"

        }

      ]

    }

  ],

"functions": {

"api/resend/emails.js": {

"memory": 1024,

"maxDuration": 10

    }

  }

}

```

## 📦 6. package.json依存関係

### package.json

```json

{

"name": "resend-email-project",

"version": "1.0.0",

"type": "module",

"scripts": {

"dev": "vite",

"dev:api": "node dev-api-server.js",

"dev:all": "concurrently \"npm run dev\"\"npm run dev:api\"",

"build": "vite build",

"preview": "vite preview"

  },

"dependencies": {

"react": "^18.3.1",

"react-dom": "^18.3.1"

  },

"devDependencies": {

"@types/react": "^18.3.5",

"@types/node": "^22.9.0",

"@types/express": "^5.0.5",

"@types/cors": "^2.8.19",

"typescript": "^5.5.3",

"vite": "^5.4.2",

"tailwindcss": "^3.4.0",

"autoprefixer": "^10.4.16",

"postcss": "^8.4.32",

"express": "^5.1.0",

"cors": "^2.8.5",

"dotenv": "^17.2.3",

"concurrently": "^9.2.1"

  }

}

```

## 🚀 7. セットアップ手順

### 1. 依存関係インストール

```bash

# 開発用APIサーバーに必要なパッケージをインストール

npminstall--save-devexpresscorsdotenvconcurrently


# 型定義をインストール（TypeScript使用時）

npminstall--save-dev@types/express@types/cors@types/node

```

### 2. Resendアカウント設定

```bash

# 1. Resendアカウント作成

# https://resend.com/signup


# 2. ドメイン認証

# DNS設定でドメインを認証（SPF/DKIM/DMARC設定）


# 3. APIキー取得

# ダッシュボードからAPIキーを生成

```

### 3. 環境変数設定

```bash

# .env.localファイルを作成

# 必要な環境変数を設定（上記の「1. 環境変数設定」を参照）

```

### 4. 開発サーバー起動

#### 方法1: 両方のサーバーを同時に起動（推奨）

```bash

# Vite開発サーバーとAPIサーバーを同時に起動

npmrundev:all

```

これで以下が同時に起動します：

- Vite開発サーバー（`http://localhost:5173`）
- 開発用APIサーバー（`http://localhost:3000`）

#### 方法2: 別々のターミナルで起動

**ターミナル1:**

```bash

npmrundev

```

**ターミナル2:**

```bash

npmrundev:api

```

#### 本番ビルド

```bash

npmrunbuild

```

**注意：**`dev-api-server.js`は開発環境専用です。本番環境ではVercel Serverless Function（`api/resend/emails.js`）が自動的に使用されます。

### 5. Vercelデプロイ

```bash

# Vercel CLIインストール

npminstall-gvercel


# デプロイ

vercel--prod


# 環境変数設定（Vercelダッシュボードまたは CLI）

vercelenvaddRESEND_API_KEY

vercelenvaddVITE_EMAIL_SENDER

vercelenvaddVITE_ADMIN_EMAIL

vercelenvaddVITE_COMPANY_NAME

```

## ✅ 8. 動作確認・テスト

### 基本的なメール送信テスト

```typescript

// テスト用の簡単な呼び出し

import { sendCustomEmail } from'./utils/resendApi';


consttestEmail=async () => {

try {

constresult=awaitsendCustomEmail({

to:'test@example.com',

subject:'テストメール',

html:'<h1>Hello World!</h1><p>これはテストメールです。</p>'

    });

console.log('Success:', result);

  } catch (error) {

console.error('Error:', error);

  }

};


// お問い合わせフォームテスト

import { sendContactEmail } from'./utils/resendApi';


consttestContactForm=async () => {

try {

constresult=awaitsendContactEmail({

name:'テスト太郎',

email:'test@example.com',

company:'テスト株式会社',

phone:'03-1234-5678',

subject:'service',

message:'これはテストメッセージです。'

    });

console.log('Contact form result:', result);

  } catch (error) {

console.error('Contact form error:', error);

  }

};

```

### デバッグ用ログ確認

```bash

# Vercel関数ログ確認

vercellogs


# ローカルでのデバッグ

npmrundev:all

# ブラウザの開発者ツールでネットワークタブを確認

# サーバー側のログも確認（dev-api-server.jsのコンソール出力）

```

## 🔧 9. トラブルシューティング

### よくある問題と解決方法

#### 1. API キーエラー

```

Error: API key not configured

```

**解決方法:**

-`.env.local`にRESEND_API_KEYが正しく設定されているか確認

- Vercelの環境変数設定を確認
- 環境変数名が `RESEND_API_KEY`または `VITE_RESEND_API_KEY`になっているか確認

#### 2. CORS エラー

```

Access to fetch blocked by CORS policy

```

**解決方法:**

-`api/resend/emails.js`のCORS設定を確認

-`vercel.json`のheaders設定を確認

- 開発環境では `dev-api-server.js`のCORS設定を確認

#### 3. ドメイン認証エラー

```

Error: Domain not verified

```

**解決方法:**

- Resendダッシュボードでドメイン認証状況を確認
- DNS設定を再確認（SPF/DKIM/DMARCレコード）
- 送信者アドレスが認証済みドメインのものか確認

#### 4. メール送信失敗

```

Email sending failed

```

**解決方法:**

- 送信者アドレスが認証済みドメインのものか確認
- Resend APIの制限を確認（無料プランの場合）
- メールヘッダーの設定を確認
- 迷惑メールフィルタに引っかかっていないか確認

#### 5. 開発環境で404エラー（`/api/resend/emails`）

```

POST http://localhost:5173/api/resend/emails 404 (Not Found)

```

**原因：**

- Viteの開発サーバーでは `api/`ディレクトリのServerless Functionが動作しない
- 開発用APIサーバーが起動していない

**解決方法：**

1.`dev-api-server.js`がプロジェクトルートに存在するか確認

2.`npm run dev:all`で両方のサーバーを起動

3. または、別々のターミナルで `npm run dev`と `npm run dev:api`を実行

4.`vite.config.ts`にプロキシ設定が追加されているか確認

#### 6. 開発用APIサーバーが起動しない

```

Error: Cannot find module 'express'

```

**解決方法：**

```bash

# 必要なパッケージをインストール

npminstall--save-devexpresscorsdotenvconcurrently

npminstall--save-dev@types/express@types/cors

```

#### 7. プロキシエラー

```

プロキシエラー: connect ECONNREFUSED 127.0.0.1:3000

```

**原因：**

- 開発用APIサーバー（`localhost:3000`）が起動していない

**解決方法：**

-`npm run dev:api`でAPIサーバーを起動

- または `npm run dev:all`で両方を同時に起動

#### 8. 迷惑メールに分類される

**原因：**

- スパムフィルタに引っかかりやすい単語の使用
- HTMLのみのメール（テキスト版がない）
- 送信者情報の不一致

**解決方法：**

- 件名に「無料」「特別」などの単語を避ける
- HTML版とプレーンテキスト版の両方を用意（自動生成される）
- 送信者情報を一貫させる
- メールヘッダーを適切に設定（実装済み）

## 🎯 10. 実装チェックリスト

### 必須確認項目

```

🚨 Resendメール実装の必須確認項目：

□ Resendアカウントが作成され、ドメインが認証されているか

□ 環境変数（RESEND_API_KEY等）が正しく設定されているか

□ api/resend/emails.js がVercel Functionsとして動作するか

□ dev-api-server.js が開発環境用に作成されているか

□ vite.config.ts にプロキシ設定が追加されているか

□ package.json に dev:api と dev:all スクリプトが追加されているか

□ CORS設定が適切に行われているか

□ お問い合わせフォームが正常に動作するか

□ 自動返信メールが送信されるか

□ 管理者通知メールが送信されるか

□ エラーハンドリングが適切に実装されているか

□ レスポンシブデザインが適用されているか

□ 開発環境でのテストが完了しているか

□ 本番環境でのテストが完了しているか

□ 迷惑メール対策が実装されているか（メールヘッダー、テキスト版等）


🚨 セキュリティ確認項目：

□ APIキーが環境変数で管理されているか

□ フロントエンドにAPIキーが露出していないか

□ 入力値のバリデーションが実装されているか

□ XSS対策が施されているか（HTMLエスケープ）

□ 送信制限（レート制限）が考慮されているか

□ メールヘッダーが適切に設定されているか

```

## 📝 11. 開発環境での動作の仕組み

### アーキテクチャ概要

```

開発環境（npm run dev:all）:

┌─────────────────┐

│ ブラウザ        │

│ localhost:5173  │

└────────┬────────┘

         │ /api/resend/emails

         ▼

┌─────────────────┐

│ Vite Dev Server │

│ localhost:5173  │

│ (プロキシ)      │

└────────┬────────┘

         │ プロキシ転送

         ▼

┌─────────────────┐

│ 開発用APIサーバー│

│ localhost:3000  │

│ dev-api-server  │

└────────┬────────┘

         │ Resend API

         ▼

┌─────────────────┐

│ Resend API      │

│ api.resend.com  │

└─────────────────┘


本番環境（Vercel）:

┌─────────────────┐

│ ブラウザ        │

│ yourdomain.com  │

└────────┬────────┘

         │ /api/resend/emails

         ▼

┌─────────────────┐

│ Vercel          │

│ Serverless Func │

│ api/resend/     │

│ emails.js       │

└────────┬────────┘

         │ Resend API

         ▼

┌─────────────────┐

│ Resend API      │

│ api.resend.com  │

└─────────────────┘

```

### 開発環境での動作フロー

1.**フロントエンド**（`src/utils/resendApi.ts`）が `/api/resend/emails`にリクエスト

2.**Viteプロキシ**（`vite.config.ts`）が `localhost:3000`に転送

3.**開発用APIサーバー**（`dev-api-server.js`）がリクエストを受信

4.**Resend API**に実際のメール送信リクエストを転送

5. レスポンスをフロントエンドに返却

### 本番環境での動作フロー

1.**フロントエンド**が `/api/resend/emails`にリクエスト

2.**Vercel**が `api/resend/emails.js`（Serverless Function）を実行

3.**Resend API**にメール送信リクエスト

4. レスポンスをフロントエンドに返却

## 🎯 12. 新規プロジェクトでの使用方法

### このマニュアルを新規プロジェクトで使用する場合

1.**ファイルをコピー**

-`api/resend/emails.js` → そのままコピー

-`dev-api-server.js` → そのままコピー

-`src/utils/resendApi.ts` → そのままコピー

2.**環境変数を設定**

-`.env.local`を作成し、プロジェクト固有の値を設定

- 特に `VITE_COMPANY_NAME`、`VITE_EMAIL_SENDER`、`VITE_ADMIN_EMAIL`を変更

3.**依存関係をインストール**

```bash

npm install --save-dev express cors dotenv concurrently

npm install --save-dev @types/express @types/cors @types/node

```

4.**設定ファイルを更新**

-`vite.config.ts`にプロキシ設定を追加

-`package.json`に `dev:api`と `dev:all`スクリプトを追加

-`vercel.json`にAPI設定を追加

5.**お問い合わせフォームを実装**

-`src/pages/Contact/Contact.tsx`を参考に実装

- または既存のフォームに `sendContactEmail`を統合

### 重要な注意事項

-**環境変数は必ずプロジェクト固有の値に変更すること**

-**Resendアカウントでドメイン認証を完了すること**

-**開発環境では `npm run dev:all`を使用すること**

-**本番環境ではVercel Serverless Functionが自動的に使用される**

このマニュアルに従って実装すれば、Resendを使用した完全なメール送信機能が構築でき、**新規プロジェクトでもそのまま使用できます**。
