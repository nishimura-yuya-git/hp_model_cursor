#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, dirname, join, normalize, relative, resolve } from 'node:path';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const srcRoot = join(projectRoot, 'src');
const warnOnly = process.env.ARCH_BOUNDARY_WARN_ONLY === '1';

const includeExtensions = new Set(['.ts', '.tsx']);
const excludeDirs = new Set(['node_modules', 'dist', 'build', 'coverage', '.git']);

function toProjectPath(filePath) {
  return relative(projectRoot, filePath).replace(/\\/g, '/');
}

function* walk(dir) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      yield* walk(fullPath);
      continue;
    }
    if (entry.isFile() && includeExtensions.has(extname(entry.name))) {
      yield fullPath;
    }
  }
}

function extractImports(source) {
  const specs = [];
  const patterns = [
    /import\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+(?:type\s+)?[^'"]+?\s+from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specs.push(match[1]);
    }
  }
  return specs;
}

function resolveImport(fromFile, specifier) {
  if (specifier.startsWith('@/')) {
    return `src/${specifier.slice(2)}`.replace(/\\/g, '/');
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const absolute = normalize(join(dirname(fromFile), specifier));
    return toProjectPath(absolute);
  }
  return null;
}

function classifyViolation(fromPath, targetPath, specifier) {
  if (fromPath.startsWith('src/pages/') && targetPath.startsWith('src/features/')) {
    return {
      severity: 'error',
      ruleId: 'ARCH-001',
      message: '業務ページから features への逆importは禁止です。',
      hint: '新機能側が業務コアを読むか、共通処理を src/utils / src/services に移してください。',
      specifier,
    };
  }

  if (fromPath.startsWith('src/utils/') && targetPath.startsWith('src/pages/')) {
    return {
      severity: 'error',
      ruleId: 'ARCH-002',
      message: 'src/utils からページ層への依存は禁止です。',
      hint: 'utils は純粋関数・共通処理に留め、ページ固有処理はページ配下へ戻してください。',
      specifier,
    };
  }

  if (fromPath.startsWith('src/utils/') && targetPath.startsWith('src/features/')) {
    return {
      severity: 'error',
      ruleId: 'ARCH-003',
      message: 'src/utils から features への依存は禁止です。',
      hint: 'features の責務を utils に持ち込まず、共通化が必要なら依存しない純粋関数にしてください。',
      specifier,
    };
  }

  return null;
}

function main() {
  const violations = [];

  for (const filePath of walk(srcRoot)) {
    const fromPath = toProjectPath(filePath);
    const source = readFileSync(filePath, 'utf8');
    for (const specifier of extractImports(source)) {
      const targetPath = resolveImport(filePath, specifier);
      if (!targetPath?.startsWith('src/')) continue;
      const violation = classifyViolation(fromPath, targetPath, specifier);
      if (violation) {
        violations.push({ ...violation, fromPath, targetPath });
      }
    }
  }

  if (violations.length === 0) {
    console.log('[check-architecture] 境界違反はありません。');
    return;
  }

  console.error('');
  console.error('[check-architecture] import方向の境界違反を検知しました');
  console.error('============================================================');
  for (const violation of violations) {
    console.error(`- ${violation.ruleId} ${violation.fromPath}`);
    console.error(`  -> ${violation.specifier} (${violation.targetPath})`);
    console.error(`  ${violation.message}`);
    console.error(`  ${violation.hint}`);
  }
  console.error('============================================================');

  if (warnOnly) {
    console.error('警告運用のため、このチェックでは失敗にしません。');
    return;
  }

  process.exit(1);
}

main();
