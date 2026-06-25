#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const warnOnly = process.env.HARD_BOUNDARY_WARN_ONLY === '1';
const baseRef = process.env.HARD_BOUNDARY_BASE || 'HEAD';
const configPath = process.env.HARD_BOUNDARY_CONFIG || '.cursor/hard-boundaries.json';

const defaultProtectedPatterns = [
  { pattern: /^supabase\/migrations\//, label: 'DBマイグレーション' },
  { pattern: /^supabase\/functions\//, label: 'Supabase Edge Function' },
  { pattern: /^api\//, label: 'APIエンドポイント' },
  { pattern: /^\.github\/workflows\//, label: 'GitHub Actions設定' },
  { pattern: /^\.cursor\/rules\//, label: 'Cursorルール' },
  { pattern: /^PROJECT_MEMORY\.md$/, label: '長期記憶・Hard Boundary定義' },
  { pattern: /^docs\/architecture\//, label: '業務フロー設計図' },
  { pattern: /^vercel\.json$/, label: 'Vercel設定' },
  { pattern: /^vite\.config\.(ts|mts|js|mjs)$/, label: 'Vite設定' },
  { pattern: /^next\.config\.(ts|mts|js|mjs)$/, label: 'Next.js設定' },
  { pattern: /^tsconfig(?:\.[^/]+)?\.json$/, label: 'TypeScript設定' },
  { pattern: /^src\/lib\/supabase\.ts$/, label: 'Supabaseクライアント初期化' },
  { pattern: /^src\/lib\/db\.ts$/, label: 'DBクライアント初期化' },
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

function readFileAtRef(ref, filePath) {
  const content = tryGit(['show', `${ref}:${filePath}`]);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function readWorkingPackageJson() {
  try {
    const content = readFileSync('package.json', 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeProjectPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function configEntryToPattern(entry, index) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`entries[${index}] はオブジェクトで指定してください。`);
  }

  const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : '案件固有の保護対象';

  if (typeof entry.path === 'string' && entry.path.trim()) {
    const normalized = normalizeProjectPath(entry.path.trim());
    return { pattern: new RegExp(`^${escapeRegExp(normalized)}$`), label };
  }

  if (typeof entry.prefix === 'string' && entry.prefix.trim()) {
    const normalized = normalizeProjectPath(entry.prefix.trim());
    return { pattern: new RegExp(`^${escapeRegExp(normalized)}`), label };
  }

  if (typeof entry.regex === 'string' && entry.regex.trim()) {
    return { pattern: new RegExp(entry.regex), label };
  }

  throw new Error(`entries[${index}] は path / prefix / regex のいずれかを指定してください。`);
}

function loadProjectBoundaryConfig() {
  if (!existsSync(configPath)) {
    return { patterns: [], errors: [] };
  }

  try {
    const content = readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);
    const entries = Array.isArray(config) ? config : config.entries;

    if (!Array.isArray(entries)) {
      return { patterns: [], errors: [`${configPath} は配列、または { "entries": [...] } で指定してください。`] };
    }

    return {
      patterns: entries.map(configEntryToPattern),
      errors: [],
    };
  } catch (error) {
    return {
      patterns: [],
      errors: [`${configPath} の読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

function collectDependencyChanges() {
  const before = readFileAtRef(baseRef, 'package.json');
  const after = readWorkingPackageJson();
  if (!before || !after) return [];

  const changes = [];
  for (const section of ['dependencies', 'devDependencies']) {
    const beforeDeps = before[section] ?? {};
    const afterDeps = after[section] ?? {};
    const names = new Set([...Object.keys(beforeDeps), ...Object.keys(afterDeps)]);
    for (const name of [...names].sort()) {
      if (beforeDeps[name] !== afterDeps[name]) {
        changes.push({
          section,
          name,
          before: beforeDeps[name] ?? '(なし)',
          after: afterDeps[name] ?? '(削除)',
        });
      }
    }
  }
  return changes;
}

function main() {
  if (!tryGit(['rev-parse', '--is-inside-work-tree'])) {
    console.log('[check-hard-boundaries] Git管理外のためスキップしました。');
    return;
  }

  const projectConfig = loadProjectBoundaryConfig();
  const protectedPatterns = [...defaultProtectedPatterns, ...projectConfig.patterns];
  const files = listChangedFiles();
  const hits = [];
  for (const file of files) {
    const normalized = normalizeProjectPath(file);
    for (const item of protectedPatterns) {
      if (item.pattern.test(normalized)) {
        hits.push({ file: normalized, label: item.label });
      }
    }
  }

  const dependencyChanges = files.includes('package.json') ? collectDependencyChanges() : [];

  if (hits.length === 0 && dependencyChanges.length === 0 && projectConfig.errors.length === 0) {
    console.log('[check-hard-boundaries] 保護対象の変更はありません。');
    return;
  }

  console.error('');
  console.error('[check-hard-boundaries] Hard Boundary 変更を検知しました');
  console.error('============================================================');

  for (const error of projectConfig.errors) {
    console.error(`- 設定エラー: ${error}`);
  }

  for (const hit of hits) {
    console.error(`- ${hit.label}: ${hit.file}`);
  }

  for (const change of dependencyChanges) {
    console.error(
      `- package.json ${change.section}: ${change.name} ${change.before} -> ${change.after}`,
    );
  }

  console.error('============================================================');
  console.error('変更契約・Evidence Map・PRテンプレの Hard Boundary 確認欄に、承認理由と検証証拠を明記してください。');
  console.error(`案件固有の保護対象は ${configPath} で追加できます。`);
  console.error(`比較元: ${baseRef}`);

  if (warnOnly) {
    console.error('警告運用のため、このチェックでは失敗にしません。');
  }

  if (!warnOnly) {
    process.exit(1);
  }
}

main();
