---
description: 

globs: 

alwaysApply: true
---
# 🔒 統合セキュリティルール（包括版）

## 環境変数管理（必須）

### 環境変数設定例

```typescript

// .env.local （開発環境）

VITE_SUPABASE_URL=https://your-project.supabase.co

VITE_SUPABASE_ANON_KEY=eyJ... # 公開キー（フロントエンド用）

SUPABASE_SERVICE_ROLE_KEY=eyJ... # サービスロールキー（サーバーサイド専用）


# セキュリティ関連

VITE_APP_ENV=development

VITE_API_BASE_URL=https://api.yourapp.com

VITE_ENABLE_ANALYTICS=true


# 外部サービス

STRIPE_PUBLIC_KEY=pk_test_...

STRIPE_SECRET_KEY=sk_test_... # サーバーサイド専用

SENDGRID_API_KEY=SG... # サーバーサイド専用


# ❌ 絶対禁止：本番環境の秘匿情報をコミット

# ❌ 絶対禁止：APIキーのハードコーディング

```

### 環境変数バリデーション

```typescript

// src/config/env.ts

constrequiredEnvVars=[

'VITE_SUPABASE_URL',

'VITE_SUPABASE_ANON_KEY',

]asconst;


constvalidateEnv= () => {

constmissing=requiredEnvVars.filter(

    (envVar) =>!import.meta.env[envVar]

  );


if (missing.length>0) {

thrownewError(

`必須の環境変数が設定されていません: ${missing.join(', ')}`

    );

  }

};


validateEnv();

```

## Supabaseセキュリティ設定

```typescript

// src/lib/supabase.ts

import { createClient } from'@supabase/supabase-js';

importtype { Database } from'@/types/database.types';


// 環境変数バリデーション（必須）

constsupabaseUrl=import.meta.env.VITE_SUPABASE_URL;

constsupabaseAnonKey=import.meta.env.VITE_SUPABASE_ANON_KEY;


if (!supabaseUrl||!supabaseAnonKey) {

thrownewError(

'Supabase環境変数が設定されていません。VITE_SUPABASE_URLとVITE_SUPABASE_ANON_KEYを確認してください。'

  );

}


// URLバリデーション

if (!supabaseUrl.startsWith('https://') ||!supabaseUrl.includes('.supabase.co')) {

thrownewError('不正なSupabase URLです');

}


exportconstsupabase=createClient<Database>(supabaseUrl, supabaseAnonKey, {

auth: {

autoRefreshToken: true,

persistSession: true,

detectSessionInUrl: true,

flowType:'pkce', // PKCE認証フロー（セキュリティ強化）

debug:import.meta.env.DEV,

  },

global: {

headers: {

'x-application-name':'luxury-brand-app',

'x-application-version':import.meta.env.VITE_APP_VERSION||'1.0.0',

    },

  },

realtime: {

params: {

eventsPerSecond:10,

    },

  },

db: {

schema:'public',

  },

});


// セキュリティイベントの監視

supabase.auth.onAuthStateChange((event, session) => {

// セキュリティログ（本番環境では外部ログサービスに送信）

if (import.meta.env.PROD) {

console.info('Auth event:', { event, userId:session?.user?.id });

  }


// 異常なログイン試行の検出

if (event==='SIGNED_OUT'&&!session) {

// 強制ログアウトの可能性

console.warn('Unexpected sign out detected');

  }

});

```

## 入力値検証・サニタイゼーション（包括版）

```typescript

// src/utils/validation.ts

import { z } from'zod';

importDOMPurifyfrom'dompurify';


// 共通バリデーションルール

constcommonRules= {

// メールアドレス（国際化対応）

email:z

    .string()

    .email('有効なメールアドレスを入力してください')

    .min(1, 'メールアドレスは必須です')

    .max(255, 'メールアドレスが長すぎます')

    .transform(email=>email.toLowerCase().trim()),


// パスワード（強力な要件）

password:z

    .string()

    .min(12, 'パスワードは12文字以上である必要があります')

    .max(128, 'パスワードが長すぎます')

    .regex(

/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,

'パスワードは大文字・小文字・数字・特殊文字を含む必要があります'

    )

    .refine(

password=>!commonPasswords.includes(password.toLowerCase()),

'よく使われるパスワードは使用できません'

    ),


// 名前（多言語対応）

name:z

    .string()

    .min(1, '名前は必須です')

    .max(100, '名前が長すぎます')

    .regex(

/^[a-zA-Zあ-ん ァ-ヴー一-龯\u3400-\u4DBF\u4E00-\u9FFF\s\-'\.]+$/,

'名前に無効な文字が含まれています'

    )

    .transform(name=>sanitizeInput(name)),


// UUID

uuid:z

    .string()

    .uuid('無効なID形式です'),


// URL

url:z

    .string()

    .url('有効なURLを入力してください')

    .refine(url=>url.startsWith('https://'), 'HTTPSのURLのみ許可されています'),


// JSON（安全性チェック付き）

safeJson:z

    .string()

    .refine(

str=> {

try {

constparsed=JSON.parse(str);

returntypeofparsed==='object'&&parsed!== null;

        } catch {

return false;

        }

      },

'有効なJSON形式ではありません'

    )

    .transform(str=>JSON.parse(str)),

};


// 複合バリデーション

exportconstschemas= {

// ユーザー登録

register:z.object({

email:commonRules.email,

password:commonRules.password,

confirmPassword:z.string().min(1, 'パスワード確認は必須です'),

firstName:commonRules.name,

lastName:commonRules.name,

agreeToTerms:z.boolean().refine(val=>val=== true, '利用規約に同意してください'),

agreeToPrivacy:z.boolean().refine(val=>val=== true, 'プライバシーポリシーに同意してください'),

  }).refine(

data=>data.password===data.confirmPassword,

    {

message:'パスワードが一致しません',

path:['confirmPassword'],

    }

  ),


// プロフィール更新

updateProfile:z.object({

firstName:commonRules.name.optional(),

lastName:commonRules.name.optional(),

bio:z

      .string()

      .max(500, '自己紹介は500文字以内で入力してください')

      .optional()

      .transform(bio=>bio?sanitizeInput(bio) : undefined),

website:commonRules.url.optional(),

avatar:z

      .instanceof(File)

      .refine(file=>file.size<=2*1024*1024, 'ファイルサイズは2MB以下である必要があります')

      .refine(

file=>['image/jpeg', 'image/png', 'image/webp'].includes(file.type),

'JPEG、PNG、WebP形式のみ対応しています'

      )

      .optional(),

  }),


// 検索クエリ

search:z.object({

query:z

      .string()

      .min(1, '検索キーワードは必須です')

      .max(100, '検索キーワードが長すぎます')

      .transform(query=>sanitizeInput(query)),

filters:z

      .object({

category:z.string().optional(),

dateFrom:z.string().datetime().optional(),

dateTo:z.string().datetime().optional(),

limit:z.number().min(1).max(100).default(20),

offset:z.number().min(0).default(0),

      })

      .optional(),

  }),

};


// 高度なサニタイゼーション

exportconstsanitizeInput= (input:string):string=> {

// HTMLタグを安全に除去

constcleaned=DOMPurify.sanitize(input, { 

ALLOWED_TAGS:[],

ALLOWED_ATTR:[],

  });


returncleaned

    .trim()

    .replace(/\s+/g, ' ') // 連続する空白を単一空白に

    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 制御文字除去

    .substring(0, 1000); // 最大長制限

};


// SQLインジェクション検出

exportconstdetectSQLInjection= (input:string):boolean=> {

constsqlPatterns=[

/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|DECLARE)\b)/i,

/(\b(OR|AND)\s+(1=1|'1'='1'|"1"="1"))/i,

/(--|\/\*|\*\/|;)/,

/(\b(xp_|sp_|fn_)\w+)/i,

/(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS)/i,

];


returnsqlPatterns.some(pattern=>pattern.test(input));

};


// XSS検出

exportconstdetectXSS= (input:string):boolean=> {

constxssPatterns=[

/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,

/javascript:/gi,

/on\w+\s*=/gi,

/data:text\/html/gi,

/<iframe\b[^>]*>/gi,

/<object\b[^>]*>/gi,

/<embed\b[^>]*>/gi,

];


returnxssPatterns.some(pattern=>pattern.test(input));

};


// よく使われるパスワードリスト（一部）

constcommonPasswords=[

'password', '123456', 'password123', 'admin', 'qwerty',

'letmein', 'welcome', 'monkey', '1234567890', 'password1'

];

```

## 認証・認可システム

### 1. 認証フック

```typescript

// src/hooks/auth/useAuth.ts

import { useContext } from'react';

import { AuthContext } from'@/contexts/AuthContext';


exportconstuseAuth= () => {

constcontext=useContext(AuthContext);

if (!context) {

thrownewError('useAuth must be used within an AuthProvider');

  }

returncontext;

};


// 権限チェックフック

exportconstusePermissions= () => {

const { user } =useAuth();


consthasPermission= (permission:string, resourceId?:string) => {

// 権限チェックロジック

returncheckUserPermission(user?.id, permission, resourceId);

  };


consthasRole= (role:string) => {

// ロールチェックロジック

returnuser?.app_metadata?.roles?.includes(role) ?? false;

  };


return { hasPermission, hasRole };

};

```

### 2. 保護されたルート

```typescript

// src/components/common/ProtectedRoute.tsx

importReactfrom'react';

import { useAuth } from'@/hooks/auth/useAuth';


interfaceProtectedRouteProps {

children:React.ReactNode;

requiredPermission?:string;

requiredRole?:string;

fallback?:React.ReactNode;

}


exportconstProtectedRoute:React.FC<ProtectedRouteProps> = ({

children,

requiredPermission,

requiredRole,

fallback

}) => {

const { user, loading } =useAuth();

const { hasPermission, hasRole } =usePermissions();


if (loading) {

return <LoadingSpinner />;

  }


if (!user) {

return <LoginRequired />;

  }


if (requiredPermission&&!hasPermission(requiredPermission)) {

returnfallback|| <AccessDenied />;

  }


if (requiredRole&&!hasRole(requiredRole)) {

returnfallback|| <AccessDenied />;

  }


return <>{children}</>;

};

```

## セキュリティヘッダー・CSP

### Content Security Policy

```typescript

// vercel.json または Next.js config

constsecurityHeaders=[

  {

key:'X-Content-Type-Options',

value:'nosniff'

  },

  {

key:'X-Frame-Options',

value:'DENY'

  },

  {

key:'X-XSS-Protection',

value:'1; mode=block'

  },

  {

key:'Referrer-Policy',

value:'strict-origin-when-cross-origin'

  },

  {

key:'Permissions-Policy',

value:'camera=(), microphone=(), geolocation=()'

  },

  {

key:'Strict-Transport-Security',

value:'max-age=31536000; includeSubDomains; preload'

  },

  {

key:'Content-Security-Policy',

value:"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com; frame-src https://js.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self';"

  }

];

```

## エラーハンドリング・ログ

### セキュリティログ

```typescript

// src/utils/security-logger.ts

interfaceSecurityEvent {

type:'auth_failure'|'permission_denied'|'suspicious_activity'|'data_breach_attempt';

userId?:string;

ip?:string;

userAgent?:string;

details:Record<string, any>;

timestamp:string;

}


exportconstlogSecurityEvent=async (event:SecurityEvent) => {

// 本番環境では外部セキュリティログサービスに送信

if (import.meta.env.PROD) {

awaitsendToSecurityService(event);

  } else {

console.warn('Security Event:', event);

  }


// 重大なセキュリティイベントは即座にアラート

if (event.type==='data_breach_attempt') {

awaitsendImmediateAlert(event);

  }

};

```

## レート制限・ブルートフォース対策（必須）

### クライアントサイドレート制限

```typescript

// src/utils/rate-limiter.ts

interfaceRateLimitConfig {

maxRequests:number;

windowMs:number;

keyGenerator: () =>string;

}


classRateLimiter {

privaterequests:Map<string, number[]> =newMap();


checkLimit(config:RateLimitConfig): { allowed:boolean; remaining:number; resetAt:number } {

constkey=config.keyGenerator();

constnow=Date.now();

constwindowStart=now-config.windowMs;


// 古いリクエストを削除

constrequests=this.requests.get(key) ||[];

constrecentRequests=requests.filter(time=>time>windowStart);


// 制限チェック

constallowed=recentRequests.length<config.maxRequests;


if (allowed) {

recentRequests.push(now);

this.requests.set(key, recentRequests);

    } else {

this.requests.set(key, recentRequests);

    }


constresetAt=recentRequests.length>0

?recentRequests[0]+config.windowMs

:now+config.windowMs;


return {

allowed,

remaining:Math.max(0, config.maxRequests-recentRequests.length),

resetAt

    };

  }


reset(key:string):void {

this.requests.delete(key);

  }

}


exportconstrateLimiter=newRateLimiter();


// ログイン試行制限

exportconstloginRateLimit= {

maxAttempts:5,

windowMs:15*60*1000, // 15分

lockoutDuration:30*60*1000, // 30分

};


// API呼び出し制限

exportconstapiRateLimit= {

maxRequests:100,

windowMs:60*1000, // 1分

};

```

### ログイン試行追跡

```typescript

// src/utils/auth-security.ts

interfaceLoginAttempt {

email:string;

timestamp:number;

success:boolean;

ip?:string;

}


classLoginAttemptTracker {

privateattempts:Map<string, LoginAttempt[]> =newMap();

privatelockouts:Map<string, number> =newMap();


recordAttempt(email:string, success:boolean, ip?:string):void {

constattempts=this.attempts.get(email) ||[];

attempts.push({

email,

timestamp:Date.now(),

success,

ip

    });

this.attempts.set(email, attempts);


// 失敗が続いた場合のロックアウト

if (!success) {

constrecentFailures=attempts

        .filter(a=>!a.success&&Date.now() -a.timestamp<loginRateLimit.windowMs);


if (recentFailures.length>=loginRateLimit.maxAttempts) {

this.lockouts.set(email, Date.now() +loginRateLimit.lockoutDuration);

// セキュリティイベントをログ

logSecurityEvent({

type:'suspicious_activity',

details: {

email,

reason:'excessive_login_attempts',

attempts:recentFailures.length

          },

timestamp:newDate().toISOString()

        });

      }

    } else {

// 成功時はロックアウトを解除

this.lockouts.delete(email);

this.attempts.delete(email);

    }

  }


isLockedOut(email:string):boolean {

constlockoutUntil=this.lockouts.get(email);

if (!lockoutUntil) return false;


if (Date.now() >lockoutUntil) {

this.lockouts.delete(email);

return false;

    }


return true;

  }


getRemainingLockoutTime(email:string):number {

constlockoutUntil=this.lockouts.get(email);

if (!lockoutUntil) return0;

returnMath.max(0, lockoutUntil-Date.now());

  }

}


exportconstloginTracker=newLoginAttemptTracker();

```

## セッション管理の強化（必須）

### セッションタイムアウトとリフレッシュ

```typescript

// src/hooks/auth/useSession.ts

importReact, { useEffect, useCallback, useState } from'react';

import { supabase } from'@/lib/supabase';

import { logSecurityEvent } from'@/utils/security-logger';


constSESSION_TIMEOUT=30*60*1000; // 30分

constSESSION_WARNING_TIME=5*60*1000; // 5分前に警告


exportconstuseSession= () => {

const [sessionExpiry, setSessionExpiry] =useState<number|null>(null);

const [showWarning, setShowWarning] =useState(false);


// セッション有効期限の更新

constrefreshSession=useCallback(async () => {

const { data: { session }, error } =awaitsupabase.auth.refreshSession();


if (error) {

logSecurityEvent({

type:'auth_failure',

details: { error:error.message },

timestamp:newDate().toISOString()

      });

return false;

    }


if (session) {

constexpiry=session.expires_at?session.expires_at*1000:Date.now() +SESSION_TIMEOUT;

setSessionExpiry(expiry);

return true;

    }


return false;

  }, []);


// セッション監視

useEffect(() => {

if (!sessionExpiry) return;


constcheckInterval=setInterval(() => {

constnow=Date.now();

consttimeUntilExpiry=sessionExpiry-now;


// 警告表示

if (timeUntilExpiry<=SESSION_WARNING_TIME&&timeUntilExpiry>0) {

setShowWarning(true);

      }


// セッション期限切れ

if (timeUntilExpiry<=0) {

setShowWarning(false);

supabase.auth.signOut();

logSecurityEvent({

type:'auth_failure',

details: { reason:'session_timeout' },

timestamp:newDate().toISOString()

        });

      }

    }, 1000);


return () =>clearInterval(checkInterval);

  }, [sessionExpiry]);


// アクティビティ検出でセッション延長

useEffect(() => {

constactivityEvents=['mousedown', 'keydown', 'scroll', 'touchstart'];

letlastActivity=Date.now();


consthandleActivity= () => {

lastActivity=Date.now();

// 10分以内のアクティビティでセッション延長

if (sessionExpiry&&Date.now() -lastActivity<10*60*1000) {

refreshSession();

      }

    };


activityEvents.forEach(event=> {

window.addEventListener(event, handleActivity);

    });


return () => {

activityEvents.forEach(event=> {

window.removeEventListener(event, handleActivity);

      });

    };

  }, [sessionExpiry, refreshSession]);


return {

sessionExpiry,

showWarning,

refreshSession,

dismissWarning: () =>setShowWarning(false)

  };

};

```

### マルチデバイス管理

```typescript

// src/utils/device-management.ts

interfaceDeviceInfo {

id:string;

name:string;

type:'desktop'|'mobile'|'tablet';

lastActive:number;

ip?:string;

userAgent:string;

}


exportconstgetDeviceInfo= ():DeviceInfo=> {

constua=navigator.userAgent;

constdeviceId=localStorage.getItem('device_id') ||generateDeviceId();

localStorage.setItem('device_id', deviceId);


letdeviceType:'desktop'|'mobile'|'tablet'='desktop';

if (/tablet|ipad|playbook|silk/i.test(ua)) {

deviceType='tablet';

  } elseif (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {

deviceType='mobile';

  }


return {

id:deviceId,

name:`${deviceType} - ${navigator.platform}`,

type:deviceType,

lastActive:Date.now(),

userAgent:ua

  };

};


constgenerateDeviceId= ():string=> {

return`device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

};


// セッション固定化攻撃対策（セッションIDの再生成）

exportconstregenerateSessionId=async ():Promise<void> => {

// ログアウト→再ログインでセッションIDを再生成

const { data: { session } } =awaitsupabase.auth.getSession();

if (session) {

awaitsupabase.auth.signOut();

// 再認証フローを開始

  }

};

```

## CSRF対策の詳細実装（必須）

### CSRFトークン生成と検証

```typescript

// src/utils/csrf.ts

// ブラウザ環境用のランダム生成関数

constrandomBytes= (length:number):Uint8Array=> {

returncrypto.getRandomValues(newUint8Array(length));

};


classCSRFTokenManager {

privatetokens:Map<string, { token:string; expiresAt:number }> =newMap();

privatereadonlyTOKEN_EXPIRY=60*60*1000; // 1時間


generateToken(sessionId:string):string {

constbytes=randomBytes(32);

consttoken=Array.from(bytes)

      .map(b=>b.toString(16).padStart(2, '0'))

      .join('');

constexpiresAt=Date.now() +this.TOKEN_EXPIRY;


this.tokens.set(sessionId, { token, expiresAt });


// 期限切れトークンのクリーンアップ

this.cleanupExpiredTokens();


returntoken;

  }


verifyToken(sessionId:string, token:string):boolean {

conststored=this.tokens.get(sessionId);


if (!stored) {

return false;

    }


if (Date.now() >stored.expiresAt) {

this.tokens.delete(sessionId);

return false;

    }


constisValid=stored.token===token;


if (isValid) {

// トークン使用後は再生成を推奨（オプション）

// this.tokens.delete(sessionId);

    }


returnisValid;

  }


privatecleanupExpiredTokens():void {

constnow=Date.now();

for (const [sessionId, { expiresAt }] ofthis.tokens.entries()) {

if (now>expiresAt) {

this.tokens.delete(sessionId);

      }

    }

  }

}


exportconstcsrfManager=newCSRFTokenManager();


// React Hook for CSRF Token

exportconstuseCSRFToken= () => {

const [token, setToken] =React.useState<string|null>(null);


useEffect(() => {

constsessionId=localStorage.getItem('session_id') ||generateSessionId();

localStorage.setItem('session_id', sessionId);


constcsrfToken=csrfManager.generateToken(sessionId);

setToken(csrfToken);

  }, []);


returntoken;

};


constgenerateSessionId= ():string=> {

return`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

};

```

### SameSite Cookie設定

```typescript

// src/lib/supabase.ts に追加

exportconstsupabase=createClient<Database>(supabaseUrl, supabaseAnonKey, {

auth: {

autoRefreshToken: true,

persistSession: true,

detectSessionInUrl: true,

flowType:'pkce',

debug:import.meta.env.DEV,

storage:typeofwindow!=='undefined'? {

getItem: (key:string) => {

constitem=localStorage.getItem(key);

returnitem?JSON.parse(item) : null;

      },

setItem: (key:string, value:string) => {

localStorage.setItem(key, JSON.stringify(value));

      },

removeItem: (key:string) => {

localStorage.removeItem(key);

      }

    } : undefined,

// Cookie設定（サーバーサイドで設定）

storageKey:'sb-auth-token',

  },

// ... 他の設定

});


// Cookie設定（サーバーサイド/Edge Function用）

exportconstcookieOptions= {

httpOnly: true,

secure:import.meta.env.PROD,

sameSite:'strict'asconst,

maxAge:60*60*24*7, // 7日

path:'/',

};

```

## ファイルアップロードセキュリティの強化（必須）

### 高度なファイル検証

```typescript

// src/utils/file-security.ts

interfaceFileValidationResult {

valid:boolean;

errors:string[];

sanitizedFileName?:string;

}


constALLOWED_MIME_TYPES= {

image:['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

document:['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],

video:['video/mp4', 'video/webm'],

};


constMAX_FILE_SIZES= {

image:5*1024*1024, // 5MB

document:10*1024*1024, // 10MB

video:50*1024*1024, // 50MB

};


exportconstvalidateFile=async (

file:File,

category:'image'|'document'|'video'

):Promise<FileValidationResult> => {

consterrors:string[]=[];


// 1. ファイルサイズチェック

constmaxSize=MAX_FILE_SIZES[category];

if (file.size>maxSize) {

errors.push(`ファイルサイズが大きすぎます（最大${maxSize / 1024 / 1024}MB）`);

  }


// 2. MIMEタイプチェック

constallowedTypes=ALLOWED_MIME_TYPES[category];

if (!allowedTypes.includes(file.type)) {

errors.push(`許可されていないファイル形式です（${file.type}）`);

  }


// 3. ファイル名のサニタイゼーション

constsanitizedFileName=sanitizeFileName(file.name);

if (sanitizedFileName!==file.name) {

errors.push('ファイル名に無効な文字が含まれています');

  }


// 4. ファイル拡張子とMIMEタイプの整合性チェック

constextension=getFileExtension(file.name);

constexpectedMimeTypes=getMimeTypesForExtension(extension);

if (expectedMimeTypes.length>0&&!expectedMimeTypes.includes(file.type)) {

errors.push('ファイル拡張子とMIMEタイプが一致しません');

  }


// 5. マジックナンバーによるファイルタイプ検証（画像のみ）

if (category==='image') {

constisValidImage=awaitvalidateImageMagicNumber(file);

if (!isValidImage) {

errors.push('ファイルの実際の形式が画像ではありません');

    }

  }


// 6. ファイル名の重複チェック（オプション）

// 7. ウイルススキャン統合（サーバーサイドで実装）


return {

valid:errors.length===0,

errors,

sanitizedFileName:errors.length===0?sanitizedFileName: undefined

  };

};


constsanitizeFileName= (fileName:string):string=> {

// 危険な文字を除去

returnfileName

    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')

    .replace(/^\.+/, '') // 先頭のドットを除去

    .replace(/\s+/g, '_') // 空白をアンダースコアに

    .substring(0, 255); // 最大長制限

};


constgetFileExtension= (fileName:string):string=> {

returnfileName.split('.').pop()?.toLowerCase() ||'';

};


constgetMimeTypesForExtension= (extension:string):string[]=> {

constmimeMap:Record<string, string[]> = {

'jpg':['image/jpeg'],

'jpeg':['image/jpeg'],

'png':['image/png'],

'webp':['image/webp'],

'gif':['image/gif'],

'pdf':['application/pdf'],

'doc':['application/msword'],

'docx':['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],

'mp4':['video/mp4'],

'webm':['video/webm'],

  };

returnmimeMap[extension]||[];

};


// マジックナンバーによる画像検証

constvalidateImageMagicNumber=async (file:File):Promise<boolean> => {

returnnewPromise((resolve) => {

constreader=newFileReader();

reader.onload= (e) => {

constarrayBuffer=e.target?.resultasArrayBuffer;

constbytes=newUint8Array(arrayBuffer.slice(0, 4));


// JPEG: FF D8 FF

if (bytes[0]===0xFF&&bytes[1]===0xD8&&bytes[2]===0xFF) {

resolve(true);

return;

      }


// PNG: 89 50 4E 47

if (bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4E&&bytes[3]===0x47) {

resolve(true);

return;

      }


// WebP: RIFF...WEBP

if (bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46) {

// WebPの場合はさらに確認が必要

resolve(true);

return;

      }


// GIF: 47 49 46 38

if (bytes[0]===0x47&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x38) {

resolve(true);

return;

      }


resolve(false);

    };

reader.readAsArrayBuffer(file.slice(0, 4));

  });

};

```

## APIセキュリティの強化（必須）

### リクエスト署名と検証

```typescript

// src/utils/api-security.ts

// ブラウザ環境用のHMAC実装

constcreateHmac=async (algorithm:string, secret:string):Promise<CryptoKey> => {

constencoder=newTextEncoder();

constkeyData=encoder.encode(secret);


returnawaitcrypto.subtle.importKey(

'raw',

keyData,

    { name:'HMAC', hash:algorithm==='sha256'?'SHA-256':'SHA-512' },

    false,

['sign']

  );

};


consthmacSign=async (data:string, key:CryptoKey):Promise<string> => {

constencoder=newTextEncoder();

constdataBuffer=encoder.encode(data);


constsignature=awaitcrypto.subtle.sign('HMAC', key, dataBuffer);

consthashArray=Array.from(newUint8Array(signature));

returnhashArray.map(b=>b.toString(16).padStart(2, '0')).join('');

};


interfaceSignedRequest {

data:any;

signature:string;

timestamp:number;

nonce:string;

}


exportconstsignRequest=async (data:any, secret:string):Promise<SignedRequest> => {

consttimestamp=Date.now();

constbytes=randomBytes(16);

constnonce=Array.from(bytes)

    .map(b=>b.toString(16).padStart(2, '0'))

    .join('');


constpayload=JSON.stringify({ data, timestamp, nonce });

constkey=awaitcreateHmac('sha256', secret);

constsignature=awaithmacSign(payload, key);


return {

data,

signature,

timestamp,

nonce

  };

};


exportconstverifyRequest=async (

request:SignedRequest,

secret:string,

maxAge:number=5*60*1000// 5分

):Promise<boolean> => {

// タイムスタンプの検証（リプレイ攻撃対策）

constage=Date.now() -request.timestamp;

if (age>maxAge||age<0) {

return false;

  }


// 署名の検証

constpayload=JSON.stringify({

data:request.data,

timestamp:request.timestamp,

nonce:request.nonce

  });


constkey=awaitcreateHmac('sha256', secret);

constexpectedSignature=awaithmacSign(payload, key);


returnrequest.signature===expectedSignature;

};


// リクエストサイズ制限

exportconstvalidateRequestSize= (requestBody:any, maxSize:number=1024*1024):boolean=> {

constsize=newBlob([JSON.stringify(requestBody)]).size;

returnsize<=maxSize;

};

```

### APIキーローテーション

```typescript

// src/utils/api-key-rotation.ts

interfaceAPIKey {

id:string;

key:string;

createdAt:number;

expiresAt?:number;

lastUsed?:number;

revoked:boolean;

}


classAPIKeyManager {

privatekeys:Map<string, APIKey> =newMap();


generateKey(expiresInDays?:number):APIKey {

constidBytes=randomBytes(8);

constid=`key_${Date.now()}_${Array.from(idBytes).map(b=> b.toString(16).padStart(2, '0')).join('')}`;

constkeyBytes=randomBytes(32);

constkey=Array.from(keyBytes).map(b=>b.toString(16).padStart(2, '0')).join('');

constcreatedAt=Date.now();

constexpiresAt=expiresInDays

?createdAt+ (expiresInDays*24*60*60*1000)

: undefined;


constapiKey:APIKey= {

id,

key,

createdAt,

expiresAt,

revoked: false

    };


this.keys.set(id, apiKey);

returnapiKey;

  }


validateKey(keyId:string, providedKey:string):boolean {

conststored=this.keys.get(keyId);


if (!stored||stored.revoked) {

return false;

    }


if (stored.expiresAt&&Date.now() >stored.expiresAt) {

return false;

    }


if (stored.key!==providedKey) {

return false;

    }


// 最終使用時刻を更新

stored.lastUsed=Date.now();

return true;

  }


revokeKey(keyId:string):void {

constkey=this.keys.get(keyId);

if (key) {

key.revoked= true;

    }

  }


rotateKey(keyId:string, expiresInDays?:number):APIKey {

this.revokeKey(keyId);

returnthis.generateKey(expiresInDays);

  }

}


exportconstapiKeyManager=newAPIKeyManager();

```

## 監査ログとフォレンジック（必須）

### 詳細な監査ログシステム

```typescript

// src/utils/audit-logger.ts

interfaceAuditLog {

id:string;

userId?:string;

action:string;

resource:string;

resourceId?:string;

ip?:string;

userAgent?:string;

requestId?:string;

metadata?:Record<string, any>;

timestamp:string;

severity:'low'|'medium'|'high'|'critical';

}


classAuditLogger {

privatelogs:AuditLog[]=[];

privatereadonlyMAX_LOGS=10000;


log(event:Omit<AuditLog, 'id'|'timestamp'>):void {

constauditLog:AuditLog= {

id:`audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

timestamp:newDate().toISOString(),

...event

    };


this.logs.push(auditLog);


// ログサイズ制限

if (this.logs.length>this.MAX_LOGS) {

this.logs.shift();

    }


// 重大なイベントは即座にアラート

if (event.severity==='critical') {

this.sendAlert(auditLog);

    }


// 本番環境では外部ログサービスに送信

if (import.meta.env.PROD) {

this.sendToLogService(auditLog);

    }

  }


query(filters: {

userId?:string;

action?:string;

resource?:string;

severity?:AuditLog['severity'];

startTime?:Date;

endTime?:Date;

  }):AuditLog[] {

returnthis.logs.filter(log=> {

if (filters.userId&&log.userId!==filters.userId) return false;

if (filters.action&&log.action!==filters.action) return false;

if (filters.resource&&log.resource!==filters.resource) return false;

if (filters.severity&&log.severity!==filters.severity) return false;

if (filters.startTime&&newDate(log.timestamp) <filters.startTime) return false;

if (filters.endTime&&newDate(log.timestamp) >filters.endTime) return false;

return true;

    });

  }


privatesendAlert(log:AuditLog):void {

// アラート送信ロジック（メール、Slack等）

console.error('🚨 CRITICAL SECURITY EVENT:', log);

  }


privateasyncsendToLogService(log:AuditLog):Promise<void> {

// 外部ログサービス（Datadog、Sentry等）への送信

// await fetch('https://logs.example.com/api/audit', {

//   method: 'POST',

//   headers: { 'Content-Type': 'application/json' },

//   body: JSON.stringify(log)

// });

  }

}


exportconstauditLogger=newAuditLogger();


// 使用例

exportconstlogUserAction= (

userId:string,

action:string,

resource:string,

metadata?:Record<string, any>

) => {

auditLogger.log({

userId,

action,

resource,

metadata,

severity:'medium',

ip:getClientIP(),

userAgent:navigator.userAgent

  });

};


constgetClientIP= ():string|undefined=> {

// クライアントサイドではIP取得が困難なため、サーバーサイドで設定

return undefined;

};

```

### 異常検知システム

```typescript

// src/utils/anomaly-detection.ts

interfaceAnomalyPattern {

type:'unusual_access_pattern'|'data_exfiltration'|'privilege_escalation'|'brute_force';

severity:'low'|'medium'|'high'|'critical';

threshold:number;

windowMs:number;

}


classAnomalyDetector {

privatepatterns:Map<string, number[]> =newMap();


detectAnomaly(

userId:string,

pattern:AnomalyPattern,

event: { action:string; resource:string; metadata?:Record<string, any> }

  ):boolean {

constkey=`${userId}_${pattern.type}`;

constnow=Date.now();

constwindowStart=now-pattern.windowMs;


constevents=this.patterns.get(key) ||[];

constrecentEvents=events.filter(time=>time>windowStart);

recentEvents.push(now);

this.patterns.set(key, recentEvents);


if (recentEvents.length>=pattern.threshold) {

// 異常検知

logSecurityEvent({

type:'suspicious_activity',

userId,

details: {

pattern:pattern.type,

eventCount:recentEvents.length,

window:pattern.windowMs,

event

        },

timestamp:newDate().toISOString()

      });


return true;

    }


return false;

  }

}


exportconstanomalyDetector=newAnomalyDetector();


// 異常パターン定義

exportconstanomalyPatterns:Record<string, AnomalyPattern> = {

rapidLoginAttempts: {

type:'brute_force',

severity:'high',

threshold:5,

windowMs:15*60*1000// 15分

  },

unusualDataAccess: {

type:'data_exfiltration',

severity:'critical',

threshold:100,

windowMs:60*60*1000// 1時間

  },

privilegeEscalation: {

type:'privilege_escalation',

severity:'critical',

threshold:1,

windowMs:24*60*60*1000// 24時間

  }

};

```

## データ保護と暗号化（必須）

### 保存時暗号化（クライアントサイド）

```typescript

// src/utils/encryption.ts

// 注意: クライアントサイドでの完全な暗号化は限定的

// 機密データはサーバーサイドで暗号化すること


exportconstencryptSensitiveData=async (

data:string,

key:CryptoKey

):Promise<string> => {

constencoder=newTextEncoder();

constdataBuffer=encoder.encode(data);


constiv=crypto.getRandomValues(newUint8Array(12));

constencrypted=awaitcrypto.subtle.encrypt(

    { name:'AES-GCM', iv },

key,

dataBuffer

  );


// IVと暗号化データを結合

constcombined=newUint8Array(iv.length+encrypted.byteLength);

combined.set(iv);

combined.set(newUint8Array(encrypted), iv.length);


returnbtoa(String.fromCharCode(...combined));

};


exportconstdecryptSensitiveData=async (

encryptedData:string,

key:CryptoKey

):Promise<string> => {

constcombined=Uint8Array.from(atob(encryptedData), c=>c.charCodeAt(0));


constiv=combined.slice(0, 12);

constencrypted=combined.slice(12);


constdecrypted=awaitcrypto.subtle.decrypt(

    { name:'AES-GCM', iv },

key,

encrypted

  );


constdecoder=newTextDecoder();

returndecoder.decode(decrypted);

};


// キー生成

exportconstgenerateEncryptionKey=async ():Promise<CryptoKey> => {

returnawaitcrypto.subtle.generateKey(

    {

name:'AES-GCM',

length:256

    },

    true,

['encrypt', 'decrypt']

  );

};

```

### 個人情報のマスキング

```typescript

// src/utils/data-masking.ts

exportconstmaskEmail= (email:string):string=> {

const [local, domain] =email.split('@');

if (!local||!domain) returnemail;


constmaskedLocal=local.length>2

?`${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`

:'*'.repeat(local.length);


return`${maskedLocal}@${domain}`;

};


exportconstmaskPhone= (phone:string):string=> {

// 090-1234-5678 -> 090-****-5678

returnphone.replace(/(\d{3})-(\d{4})-(\d{4})/, '$1-****-$3');

};


exportconstmaskCreditCard= (cardNumber:string):string=> {

// 1234-5678-9012-3456 -> ****-****-****-3456

returncardNumber.replace(/(\d{4})-(\d{4})-(\d{4})-(\d{4})/, '****-****-****-$4');

};


exportconstmaskPersonalInfo= (data:Record<string, any>):Record<string, any> => {

constmasked= { ...data };


if (masked.email) masked.email=maskEmail(masked.email);

if (masked.phone) masked.phone=maskPhone(masked.phone);

if (masked.creditCard) masked.creditCard=maskCreditCard(masked.creditCard);


returnmasked;

};

```

## 依存関係のセキュリティ管理（必須）

### 自動脆弱性スキャン

```typescript

// scripts/security-scan.js

import { execSync } from'child_process';

import { readFileSync } from'fs';


construnSecurityScan= () => {

console.log('🔒 セキュリティスキャンを実行中...');


// npm audit実行

try {

constauditResult=execSync('npm audit --json', { encoding:'utf-8' });

constaudit=JSON.parse(auditResult);


if (audit.vulnerabilities&&Object.keys(audit.vulnerabilities).length>0) {

console.error('❌ 脆弱性が検出されました:');

Object.entries(audit.vulnerabilities).forEach(([name, vuln]:[string, any]) => {

if (vuln.severity==='high'||vuln.severity==='critical') {

console.error(`  - ${name}: ${vuln.severity} - ${vuln.title}`);

        }

      });

process.exit(1);

    }


console.log('✅ 脆弱性は検出されませんでした');

  } catch (error) {

console.error('❌ セキュリティスキャンエラー:', error);

process.exit(1);

  }


// 禁止パッケージチェック

constpackageJson=JSON.parse(readFileSync('package.json', 'utf-8'));

constforbiddenPackages=[

'eval',

'vm',

'child_process',

'fs',

'path'

];


constallDeps= {

...packageJson.dependencies,

...packageJson.devDependencies

  };


forbiddenPackages.forEach(pkg=> {

if (allDeps[pkg]) {

console.error(`❌ 禁止パッケージが検出されました: ${pkg}`);

process.exit(1);

    }

  });

};


runSecurityScan();

```

### セキュリティパッチ管理

```typescript

// src/utils/dependency-security.ts

interfaceDependencyVulnerability {

package:string;

version:string;

severity:'low'|'medium'|'high'|'critical';

description:string;

fixedVersion?:string;

}


exportconstcheckDependencySecurity=async ():Promise<DependencyVulnerability[]> => {

// npm audit APIを使用（実際の実装では外部サービスを利用）

// 例: Snyk API、GitHub Security Advisories等


constvulnerabilities:DependencyVulnerability[]=[];


// 実装例（実際のAPI呼び出し）

// const response = await fetch('https://api.snyk.io/v1/test/npm', {

//   method: 'POST',

//   headers: { 'Authorization': `token ${SNYK_TOKEN}` },

//   body: JSON.stringify({ package: 'package.json' })

// });

// const result = await response.json();


returnvulnerabilities;

};


exportconstgetSecurityRecommendations= (

vulnerabilities:DependencyVulnerability[]

):string[]=> {

constrecommendations:string[]=[];


vulnerabilities.forEach(vuln=> {

if (vuln.severity==='critical'||vuln.severity==='high') {

recommendations.push(

`緊急: ${vuln.package} に ${vuln.severity} レベルの脆弱性が検出されました。`+

        (vuln.fixedVersion?` ${vuln.fixedVersion} に更新してください。`:'')

      );

    }

  });


returnrecommendations;

};

```

## セキュリティテスト（必須）

### 自動セキュリティテスト

```typescript

// src/tests/security.test.ts

import { describe, it, expect } from'vitest';

import {

sanitizeInput,

detectSQLInjection,

detectXSS,

validateFile,

verifyRequest

} from'@/utils/security';


describe('セキュリティテスト', () => {

describe('入力値サニタイゼーション', () => {

it('XSS攻撃を検出する', () => {

constxssPayloads=[

'<script>alert("xss")</script>',

'javascript:alert("xss")',

'<img src="x" onerror="alert(1)">',

'<iframe src="javascript:alert(1)"></iframe>'

];


xssPayloads.forEach(payload=> {

expect(detectXSS(payload)).toBe(true);

expect(sanitizeInput(payload)).not.toContain('<script>');

      });

    });


it('SQLインジェクションを検出する', () => {

constsqlPayloads=[

"'; DROP TABLE users; --",

"admin'--",

"' OR '1'='1",

"UNION SELECT * FROM users"

];


sqlPayloads.forEach(payload=> {

expect(detectSQLInjection(payload)).toBe(true);

      });

    });

  });


describe('ファイル検証', () => {

it('不正なファイルタイプを拒否する', async () => {

constmaliciousFile=newFile(['malicious'], 'malicious.exe', {

type:'application/x-msdownload'

      });


constresult=awaitvalidateFile(maliciousFile, 'image');

expect(result.valid).toBe(false);

expect(result.errors.length).toBeGreaterThan(0);

    });


it('ファイルサイズ制限を強制する', async () => {

constlargeFile=newFile(

newArray(10*1024*1024).fill(0),

'large.jpg',

        { type:'image/jpeg' }

      );


constresult=awaitvalidateFile(largeFile, 'image');

expect(result.valid).toBe(false);

    });

  });


describe('リクエスト署名', () => {

it('署名の検証が正しく動作する', () => {

constsecret='test-secret';

constdata= { userId:'123', action:'update' };


constsigned=signRequest(data, secret);

expect(verifyRequest(signed, secret)).toBe(true);

    });


it('期限切れリクエストを拒否する', () => {

constsecret='test-secret';

constdata= { userId:'123', action:'update' };


constsigned=signRequest(data, secret);

signed.timestamp=Date.now() -10*60*1000; // 10分前


expect(verifyRequest(signed, secret, 5*60*1000)).toBe(false);

    });

  });

});

```

## インシデント対応計画（必須）

### セキュリティインシデント対応フロー

```typescript

// src/utils/incident-response.ts

interfaceSecurityIncident {

id:string;

type:'data_breach'|'unauthorized_access'|'malware'|'ddos'|'other';

severity:'low'|'medium'|'high'|'critical';

detectedAt:string;

description:string;

affectedUsers?:string[];

status:'detected'|'investigating'|'contained'|'resolved'|'closed';

}


classIncidentResponseManager {

privateincidents:SecurityIncident[]=[];


reportIncident(incident:Omit<SecurityIncident, 'id'|'detectedAt'|'status'>):string {

constincidentId=`incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;


constfullIncident:SecurityIncident= {

id:incidentId,

detectedAt:newDate().toISOString(),

status:'detected',

...incident

    };


this.incidents.push(fullIncident);


// 重大なインシデントは即座にエスカレーション

if (fullIncident.severity==='critical') {

this.escalateIncident(fullIncident);

    }


// インシデント対応フローを開始

this.startResponseFlow(fullIncident);


returnincidentId;

  }


privateescalateIncident(incident:SecurityIncident):void {

// 管理者への通知

console.error('🚨 CRITICAL SECURITY INCIDENT:', incident);


// 外部通知サービスへの送信

// await sendAlertToSecurityTeam(incident);

  }


privateasyncstartResponseFlow(incident:SecurityIncident):Promise<void> {

// 1. インシデントの記録

auditLogger.log({

action:'security_incident_detected',

resource:'security',

resourceId:incident.id,

metadata: { incident },

severity:incident.severity

    });


// 2. 影響範囲の特定

if (incident.type==='data_breach') {

awaitthis.assessDataBreach(incident);

    }


// 3. 封じ込め措置

awaitthis.containIncident(incident);


// 4. 復旧作業

awaitthis.recoverFromIncident(incident);

  }


privateasyncassessDataBreach(incident:SecurityIncident):Promise<void> {

// 影響を受けたデータの特定

// 影響を受けたユーザーの特定

// 法的通知要件の確認

  }


privateasynccontainIncident(incident:SecurityIncident):Promise<void> {

// 影響を受けたシステムの隔離

// アクセスの無効化

// パスワードリセットの強制

  }


privateasyncrecoverFromIncident(incident:SecurityIncident):Promise<void> {

// システムの復旧

// セキュリティパッチの適用

// 再発防止策の実装

  }

}


exportconstincidentResponseManager=newIncidentResponseManager();

```

## セキュリティチェックリスト（拡張版）

### 開発時チェック項目

- [ ] 環境変数が適切に管理されているか
- [ ] ハードコーディングされた機密情報がないか
- [ ] 全てのユーザー入力にバリデーションが実装されているか
- [ ] SQLインジェクション対策が適切か
- [ ] XSS対策が適切か
- [ ] CSRF対策が実装されているか（トークン検証）
- [ ] 認証・認可が適切に実装されているか
- [ ] RLSポリシーが適切に設定されているか
- [ ] エラーハンドリングで情報漏洩がないか
- [ ] ログ出力に機密情報が含まれていないか
- [ ] セキュリティヘッダーが適切に設定されているか
- [ ] ファイルアップロードの制限が適切か（サイズ、タイプ、マジックナンバー）
- [ ] APIレート制限が実装されているか
- [ ] セッション管理が適切か（タイムアウト、リフレッシュ）
- [ ] 暗号化が適切に実装されているか（保存時・転送時）
- [ ] **レート制限とブルートフォース対策が実装されているか**
- [ ] **CSRFトークンが生成・検証されているか**
- [ ] **セッション固定化攻撃対策が実装されているか**
- [ ] **ファイルアップロードでマジックナンバー検証が実装されているか**
- [ ] **APIリクエスト署名が実装されているか**
- [ ] **監査ログが適切に記録されているか**
- [ ] **異常検知システムが実装されているか**
- [ ] **個人情報のマスキングが実装されているか**
- [ ] **依存関係の脆弱性スキャンが定期実行されているか**
- [ ] **セキュリティテストが自動化されているか**
- [ ] **インシデント対応計画が策定されているか**

### デプロイ前チェック項目

- [ ] セキュリティヘッダーが設定されているか
- [ ] HTTPSが強制されているか
- [ ] 環境変数が適切に設定されているか
- [ ] セキュリティスキャンがパスしているか
- [ ] 監査ログが有効になっているか
- [ ] バックアップと復旧計画が整備されているか

### 運用時チェック項目

- [ ] セキュリティログを定期的に確認しているか
- [ ] 異常なアクセスパターンを監視しているか
- [ ] 依存関係の脆弱性を定期的にチェックしているか
- [ ] セキュリティパッチを迅速に適用しているか
- [ ] インシデント対応チームが準備されているか
