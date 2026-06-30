#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const jsonMode = process.argv.includes('--json');
const baseRef = process.env.LOOP_BASE || 'HEAD';
const statePath = process.env.LOOP_STATE_FILE || 'state/loop-findings.json';

const importantRules = [
  '.cursor/rules/safety.mdc',
  '.cursor/rules/agent-loops.mdc',
  '.cursor/rules/change-contract.mdc',
  '.cursor/rules/invariants.mdc',
  '.cursor/rules/architecture-extension.mdc',
  'PROJECT_MEMORY.md',
  'loops/goals/main-doctor.md',
  'loops/goals/bug-fix.md',
  'loops/goals/regression-guard.md',
  'loops/goals/ssot-debt-hunter.md',
  'loops/goals/ui-polish.md',
  '.cursor/rules/ui-design.mdc',
  '.cursor/rules/ui-design-hp-lp.mdc',
  '.cursor/rules/ui-language.mdc',
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

function readFirstLines(filePath, maxLines = 40) {
  if (!existsSync(filePath)) return null;
  const lines = readFileSync(filePath, 'utf8').split('\n').slice(0, maxLines);
  return lines.join('\n');
}

function runEvaluateJson() {
  const result = spawnSync('node', ['scripts/loop-evaluate.mjs', '--json'], {
    encoding: 'utf8',
    shell: false,
  });
  try {
    return JSON.parse(result.stdout);
  } catch {
    return {
      decision: {
        status: 'stop',
        reason: 'loop-evaluate のJSONを解析できませんでした。',
        nextAction: 'npm run loop:evaluate を直接確認してください。',
      },
      raw: result.stdout,
      error: result.stderr,
    };
  }
}

function runDiscoverJson() {
  const result = spawnSync('node', ['scripts/loop-discover.mjs', '--json'], {
    encoding: 'utf8',
    shell: false,
  });
  try {
    return JSON.parse(result.stdout);
  } catch {
    return {
      summary: { total: 1, stop: 1, warn: 0, info: 0 },
      findings: [
        {
          type: 'loop-discover',
          severity: 'stop',
          title: 'loop-discover のJSONを解析できませんでした。',
          nextAction: 'npm run loop:discover を直接確認してください。',
        },
      ],
      raw: result.stdout,
      error: result.stderr,
    };
  }
}

function runEvaluatorJson() {
  const result = spawnSync('node', ['scripts/loop-evaluator.mjs', '--json'], {
    encoding: 'utf8',
    shell: false,
  });
  try {
    return JSON.parse(result.stdout);
  } catch {
    return {
      verdict: {
        status: 'stop',
        reason: 'loop-evaluator のJSONを解析できませんでした。',
        requiredActions: ['npm run loop:evaluator を直接確認してください。'],
      },
      raw: result.stdout,
      error: result.stderr,
    };
  }
}

function readLoopState() {
  if (!existsSync(statePath)) return null;
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return {
      error: `状態ファイルを解析できません: ${statePath}`,
    };
  }
}

function buildContext() {
  const changedFiles = listChangedFiles();
  const evaluation = runEvaluateJson();
  const discovery = runDiscoverJson();
  const evaluator = runEvaluatorJson();
  const loopState = readLoopState();
  const ruleSnippets = importantRules
    .filter((filePath) => existsSync(filePath))
    .map((filePath) => ({
      filePath,
      snippet: readFirstLines(filePath),
    }));

  return {
    generatedAt: new Date().toISOString(),
    mode: 'main-safe',
    baseRef,
    changedFiles,
    evaluation,
    discovery,
    evaluator,
    loopState,
    ruleSnippets,
  };
}

function printMarkdown(context) {
  console.log('# Main Doctor Loop Context');
  console.log('');
  console.log(`- generatedAt: ${context.generatedAt}`);
  console.log(`- mode: ${context.mode}`);
  console.log(`- baseRef: ${context.baseRef}`);
  console.log(`- decision: ${context.evaluation.decision?.status ?? 'unknown'}`);
  console.log(`- reason: ${context.evaluation.decision?.reason ?? 'unknown'}`);
  console.log('');
  console.log('## Changed Files');
  if (context.changedFiles.length === 0) {
    console.log('- なし');
  } else {
    for (const file of context.changedFiles) {
      console.log(`- ${file}`);
    }
  }
  console.log('');
  console.log('## Recommended Commands');
  const commands = context.evaluation.recommendedCommands ?? [];
  if (commands.length === 0) {
    console.log('- なし');
  } else {
    for (const command of commands) {
      console.log(`- ${command}`);
    }
  }
  console.log('');
  console.log('## Loop Discovery');
  const findings = context.discovery?.findings ?? [];
  if (findings.length === 0) {
    console.log('- 発見事項なし');
  } else {
    for (const finding of findings.slice(0, 8)) {
      console.log(`- ${finding.severity}: ${finding.title}`);
    }
  }
  console.log('');
  console.log('## Independent Evaluator');
  console.log(`- status: ${context.evaluator?.verdict?.status ?? 'unknown'}`);
  console.log(`- reason: ${context.evaluator?.verdict?.reason ?? 'unknown'}`);
  console.log('');
  console.log('## Loop State');
  if (context.loopState) {
    console.log(`- ${statePath}`);
  } else {
    console.log('- なし');
  }
  console.log('');
  console.log('## Context Sources');
  for (const rule of context.ruleSnippets) {
    console.log(`- ${rule.filePath}`);
  }
}

const context = buildContext();
if (jsonMode) {
  console.log(JSON.stringify(context, null, 2));
} else {
  printMarkdown(context);
}
