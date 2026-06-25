#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const baseRef = process.env.CHANGED_BASE || 'HEAD';

const changeSurfaces = [
  ['src/pages/', '画面・ページ'],
  ['src/components/', '共通UI・コンポーネント'],
  ['api/', 'API・Serverless Function'],
  ['supabase/migrations/', 'DBマイグレーション'],
  ['supabase/functions/', 'Supabase Edge Function'],
  ['supabase/', 'Supabase設定・DB関連'],
  ['scripts/', '開発支援スクリプト'],
];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return '';
  }
}

function listChangedFiles() {
  const diffFiles = tryGit(['diff', '--name-only', '--diff-filter=ACMR', baseRef, '--'])
    .split('\n')
    .filter(Boolean);
  const untrackedFiles = tryGit(['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter(Boolean);
  return [...new Set([...diffFiles, ...untrackedFiles])].sort();
}

function relatedTestCandidates(file) {
  if (!/\.(ts|tsx)$/.test(file)) return [];
  const candidates = [];
  const withoutExt = file.replace(/\.(ts|tsx)$/, '');
  candidates.push(`${withoutExt}.test.ts`);
  candidates.push(`${withoutExt}.test.tsx`);
  candidates.push(file.replace(/\/([^/]+)\.(ts|tsx)$/, '/__tests__/$1.test.ts'));
  candidates.push(file.replace(/\/([^/]+)\.(ts|tsx)$/, '/__tests__/$1.test.tsx'));
  return candidates.filter((candidate) => existsSync(candidate));
}

function addCommand(commands, command, reason) {
  if (!commands.some((item) => item.command === command)) {
    commands.push({ command, reason });
  }
}

function main() {
  if (!tryGit(['rev-parse', '--is-inside-work-tree'])) {
    console.log('[test:changed] Git管理外のため推奨テストを判定できません。');
    return;
  }

  const files = listChangedFiles();
  if (files.length === 0) {
    console.log('[test:changed] 変更ファイルはありません。');
    return;
  }

  const commands = [];
  const affectedSurfaces = [];

  for (const file of files) {
    for (const [prefix, label] of changeSurfaces) {
      if (file.startsWith(prefix) || file === prefix) {
        affectedSurfaces.push(label);
      }
    }

    for (const testFile of relatedTestCandidates(file)) {
      addCommand(commands, `pnpm exec vitest run ${testFile}`, `${file} に対応する近接テスト`);
    }
  }

  if (files.some((file) => file.startsWith('supabase/') || file.startsWith('api/'))) {
    addCommand(commands, 'pnpm run check:hard-boundaries', 'DB・API・外部連携境界の確認');
  }

  if (files.some((file) => file.startsWith('src/') || file.startsWith('scripts/'))) {
    addCommand(commands, 'pnpm run type-check', 'TypeScript型の整合性確認');
  }

  if (files.some((file) => file.startsWith('src/pages/') || file.startsWith('src/components/'))) {
    addCommand(commands, 'pnpm run test:e2e -- --list', '該当画面のE2E候補確認');
  }

  if (files.some((file) => file.startsWith('.cursor/rules/') || file === 'PROJECT_MEMORY.md')) {
    addCommand(commands, 'pnpm run check:provenance', 'ルール・長期記憶変更時の不変条件接続確認');
  }

  addCommand(commands, 'pnpm run check:hard-boundaries', '保護対象変更の検知');
  addCommand(commands, 'pnpm run check:architecture', 'import方向の境界確認');

  console.log('[test:changed] 変更ファイル');
  for (const file of files) {
    console.log(`- ${file}`);
  }

  if (affectedSurfaces.length > 0) {
    console.log('');
    console.log('[test:changed] 影響する変更面');
    for (const label of [...new Set(affectedSurfaces)].sort()) {
      console.log(`- ${label}`);
    }
  }

  console.log('');
  console.log('[test:changed] 推奨検証コマンド');
  for (const item of commands) {
    console.log(`- ${item.command}`);
    console.log(`  理由: ${item.reason}`);
  }
}

main();
