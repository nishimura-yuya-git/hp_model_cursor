#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const jsonMode = process.argv.includes('--json');
const baseRef = process.env.LOOP_BASE || 'HEAD';

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

function detectPackageManager() {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const packageManager = typeof packageJson.packageManager === 'string' ? packageJson.packageManager : '';

    if (packageManager.startsWith('pnpm@')) return 'pnpm';
    if (packageManager.startsWith('yarn@')) return 'yarn';
    if (packageManager.startsWith('npm@')) return 'npm';
  } catch {
    // package.json が読めない場合は、この基盤の標準である pnpm を使う。
  }

  return 'pnpm';
}

function runPackageScript(packageManager, scriptName) {
  return runCommand(scriptName, packageManager, ['run', scriptName]);
}

function runCommand(name, command, args, env = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, ...env },
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return {
    name,
    command: [command, ...args].join(' '),
    status: result.status ?? 1,
    stdout,
    stderr,
  };
}

function detectRecommendedCommands(output) {
  return Array.from(output.matchAll(/^- (npm|npx|pnpm|deno|node)\s+(.+)$/gm), (match) =>
    `${match[1]} ${match[2]}`.trim(),
  );
}

function decide({ changedFiles, doctorResult, testChangedResult }) {
  const combined = `${doctorResult.stdout}\n${doctorResult.stderr}\n${testChangedResult.stdout}\n${testChangedResult.stderr}`;
  const hardBoundary = combined.includes('[check-hard-boundaries] Hard Boundary 変更を検知しました');
  const requiredFailure = doctorResult.status !== 0 || combined.includes('FAIL:');
  const warnings = combined.includes('WARN:') || combined.includes('[doctor] 警告があります');
  const noChanges = changedFiles.length === 0;

  if (requiredFailure) {
    return {
      status: 'stop',
      reason: 'doctor の必須チェックに失敗しています。',
      nextAction: '上の失敗ログを確認し、修正または人間判断を行ってください。',
    };
  }

  if (hardBoundary) {
    return {
      status: 'stop',
      reason: 'Hard Boundary 変更を検知しました。',
      nextAction: '変更契約と Evidence Map を更新し、ユーザー承認を取ってください。',
    };
  }

  if (warnings) {
    return {
      status: 'warn',
      reason: '必須チェックは通っていますが、警告があります。',
      nextAction: '警告が既存負債か今回の変更由来か確認してください。',
    };
  }

  if (noChanges) {
    return {
      status: 'pass',
      reason: '変更ファイルはありません。',
      nextAction: '追加対応は不要です。',
    };
  }

  return {
    status: 'pass',
    reason: 'Main Doctor Loop の標準評価は通過しました。',
    nextAction: '必要に応じて推奨検証コマンドを実行してください。',
  };
}

function printHuman(summary) {
  console.log('[loop:evaluate] Main Doctor Loop 評価結果');
  console.log(`status: ${summary.decision.status}`);
  console.log(`reason: ${summary.decision.reason}`);
  console.log(`next: ${summary.decision.nextAction}`);

  console.log('');
  console.log('changed files:');
  if (summary.changedFiles.length === 0) {
    console.log('- なし');
  } else {
    for (const file of summary.changedFiles) {
      console.log(`- ${file}`);
    }
  }

  console.log('');
  console.log('recommended commands:');
  if (summary.recommendedCommands.length === 0) {
    console.log('- なし');
  } else {
    for (const command of summary.recommendedCommands) {
      console.log(`- ${command}`);
    }
  }

  console.log('');
  console.log('checks:');
  for (const check of summary.checks) {
    const mark = check.status === 0 ? 'OK' : 'FAIL';
    console.log(`- ${mark}: ${check.name} (${check.command})`);
  }
}

function main() {
  if (!tryGit(['rev-parse', '--is-inside-work-tree'])) {
    const summary = {
      generatedAt: new Date().toISOString(),
      mode: 'main-safe',
      changedFiles: [],
      recommendedCommands: [],
      checks: [],
      decision: {
        status: 'stop',
        reason: 'Git管理外のため評価できません。',
        nextAction: 'Gitリポジトリ内で実行してください。',
      },
    };
    console.log(JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  const changedFiles = listChangedFiles();
  const packageManager = detectPackageManager();
  const doctorResult = runPackageScript(packageManager, 'doctor');
  const testChangedResult = runPackageScript(packageManager, 'test:changed');
  const recommendedCommands = detectRecommendedCommands(testChangedResult.stdout);
  const decision = decide({ changedFiles, doctorResult, testChangedResult });

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: 'main-safe',
    baseRef,
    changedFiles,
    recommendedCommands,
    checks: [
      {
        name: doctorResult.name,
        command: doctorResult.command,
        status: doctorResult.status,
      },
      {
        name: testChangedResult.name,
        command: testChangedResult.command,
        status: testChangedResult.status,
      },
    ],
    decision,
  };

  if (jsonMode) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  printHuman(summary);
}

main();
