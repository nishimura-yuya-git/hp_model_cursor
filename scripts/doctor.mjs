#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const checks = [
  {
    name: 'Hard Boundary',
    script: 'check:hard-boundaries',
    env: { HARD_BOUNDARY_WARN_ONLY: '1' },
    required: false,
  },
  {
    name: 'SSoT再実装',
    script: 'check:ssot',
    required: false,
  },
  {
    name: 'import境界',
    script: 'check:architecture',
    required: true,
  },
  {
    name: '不変条件provenance',
    script: 'check:provenance',
    required: true,
  },
  {
    name: '変更面ごとの推奨検証',
    script: 'test:changed',
    required: false,
  },
];

function readPackageScripts() {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    return packageJson.scripts ?? {};
  } catch {
    return {};
  }
}

function canRunCheck(check, packageScripts) {
  return Boolean(packageScripts[check.script]);
}

function runCheck(check) {
  console.log('');
  console.log(`=== ${check.name} ===`);
  const result = spawnSync('pnpm', ['run', check.script], {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...(check.env ?? {}) },
  });
  return {
    ...check,
    status: result.status ?? 1,
  };
}

function main() {
  console.log('[doctor] プロジェクトの整合性チェックを開始します。');

  const packageScripts = readPackageScripts();
  const runnableChecks = checks.filter((check) => canRunCheck(check, packageScripts));
  const skippedChecks = checks.filter((check) => !canRunCheck(check, packageScripts));
  const results = runnableChecks.map(runCheck);
  const failed = results.filter((result) => result.status !== 0);
  const requiredFailed = failed.filter((result) => result.required);

  console.log('');
  console.log('=== doctor summary ===');
  for (const result of results) {
    const mark = result.status === 0 ? 'OK' : result.required ? 'FAIL' : 'WARN';
    console.log(`- ${mark}: ${result.name}`);
  }
  for (const check of skippedChecks) {
    console.log(`- SKIP: ${check.name} (${check.script} が package.json にありません)`);
  }

  if (requiredFailed.length > 0) {
    console.error('');
    console.error('[doctor] 必須チェックに失敗しました。上のログを確認してください。');
    process.exit(1);
  }

  if (failed.length > 0) {
    console.error('');
    console.error('[doctor] 警告があります。必要に応じて Evidence Map / PRテンプレに理由と検証証拠を残してください。');
    return;
  }

  console.log('');
  console.log('[doctor] すべてのチェックが完了しました。');
}

main();
