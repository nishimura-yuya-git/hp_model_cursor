#!/bin/bash

# 禁止ライブラリチェックスクリプト（シェル版）
# .cursor/rules/core.mdc の禁止ライブラリリストに基づいてチェック

set -e

FORBIDDEN_LIBS=(
  "lucide-react"
  "@heroicons/react"
  "react-icons"
  "feather-icons"
  "@fortawesome/react-fontawesome"
  "moment"
  "lodash"
)

echo "🚨 禁止ライブラリの使用をチェック中..."
echo ""

VIOLATIONS=0
TOTAL_VIOLATIONS=0

# package.jsonのチェック
if [ -f "package.json" ]; then
  echo "📦 package.jsonをチェック中..."
  for lib in "${FORBIDDEN_LIBS[@]}"; do
    # package.json内の依存関係をチェック
    if grep -q "\"$lib\"" package.json 2>/dev/null; then
      echo "❌ エラー: package.jsonに禁止ライブラリ '$lib' が含まれています"
      VIOLATIONS=$((VIOLATIONS + 1))
      TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
    fi
  done
  
  if [ $VIOLATIONS -eq 0 ]; then
    echo "✅ package.jsonに禁止ライブラリは検出されませんでした"
  fi
  echo ""
fi

# ソースコードのチェック
if [ -d "src" ]; then
  echo "📁 ソースコードをチェック中..."
  VIOLATIONS=0
  
  for lib in "${FORBIDDEN_LIBS[@]}"; do
    # インポート文をチェック
    ESCAPED_LIB=$(echo "$lib" | sed 's/[.*+?^${}()|[\]\\]/\\&/g')
    
    # import文のチェック
    if find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
      -exec grep -l "from ['\"]$ESCAPED_LIB['\"]" {} \; 2>/dev/null | grep -v node_modules | grep -v ".vite" | head -1 > /dev/null; then
      echo "❌ エラー: 禁止ライブラリ '$lib' がインポートされています"
      find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
        -exec grep -l "from ['\"]$ESCAPED_LIB['\"]" {} \; 2>/dev/null | grep -v node_modules | grep -v ".vite" | while read -r file; do
        echo "   ファイル: $file"
      done
      VIOLATIONS=$((VIOLATIONS + 1))
      TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
    fi
    
    # require文のチェック
    if find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
      -exec grep -l "require(['\"]$ESCAPED_LIB['\"])" {} \; 2>/dev/null | grep -v node_modules | grep -v ".vite" | head -1 > /dev/null; then
      echo "❌ エラー: 禁止ライブラリ '$lib' がrequireされています"
      find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
        -exec grep -l "require(['\"]$ESCAPED_LIB['\"])" {} \; 2>/dev/null | grep -v node_modules | grep -v ".vite" | while read -r file; do
        echo "   ファイル: $file"
      done
      VIOLATIONS=$((VIOLATIONS + 1))
      TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
    fi
  done
  
  if [ $VIOLATIONS -eq 0 ]; then
    echo "✅ ソースコードに禁止ライブラリは検出されませんでした"
  fi
  echo ""
fi

# 結果の表示
if [ $TOTAL_VIOLATIONS -gt 0 ]; then
  echo "❌ 合計 $TOTAL_VIOLATIONS 件の違反が検出されました"
  echo ""
  echo "💡 対処方法:"
  echo "   1. 禁止ライブラリを削除してください"
  echo "   2. カスタムSVGアイコンを使用してください"
  echo "   3. 詳細は .cursor/rules/core.mdc を参照してください"
  exit 1
else
  echo "✅ 禁止ライブラリは検出されませんでした"
  exit 0
fi

