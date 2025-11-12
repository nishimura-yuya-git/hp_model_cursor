#!/bin/bash

# 禁止ライブラリチェックスクリプト（シェル版）
# .cursor/rules/core.mdc の禁止ライブラリリストに基づいてチェック

# set -e をコメントアウト（エラーハンドリングを明示的に行うため）
# set -e

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
    
    # import文のチェック（node_modules、.vite、dist、buildを除外）
    FOUND_FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
      ! -path "*/node_modules/*" \
      ! -path "*/.vite/*" \
      ! -path "*/dist/*" \
      ! -path "*/build/*" \
      ! -path "*/.git/*" \
      -exec grep -l "from ['\"]$ESCAPED_LIB['\"]" {} \; 2>/dev/null || true)
    
    if [ -n "$FOUND_FILES" ]; then
      echo "❌ エラー: 禁止ライブラリ '$lib' がインポートされています"
      echo "$FOUND_FILES" | while read -r file; do
        if [ -n "$file" ]; then
          echo "   ファイル: $file"
        fi
      done
      VIOLATIONS=$((VIOLATIONS + 1))
      TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
    fi
    
    # require文のチェック（node_modules、.vite、dist、buildを除外）
    FOUND_FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
      ! -path "*/node_modules/*" \
      ! -path "*/.vite/*" \
      ! -path "*/dist/*" \
      ! -path "*/build/*" \
      ! -path "*/.git/*" \
      -exec grep -l "require(['\"]$ESCAPED_LIB['\"])" {} \; 2>/dev/null || true)
    
    if [ -n "$FOUND_FILES" ]; then
      echo "❌ エラー: 禁止ライブラリ '$lib' がrequireされています"
      echo "$FOUND_FILES" | while read -r file; do
        if [ -n "$file" ]; then
          echo "   ファイル: $file"
        fi
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

