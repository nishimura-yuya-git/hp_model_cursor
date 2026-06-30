#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const jsonMode = process.argv.includes('--json');
const statePath = process.env.LOOP_STATE_FILE || 'state/loop-findings.json';

function runJson(name, command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
  });

  try {
    return {
      name,
      command: [command, ...args].join(' '),
      status: result.status ?? 1,
      json: JSON.parse(result.stdout),
    };
  } catch {
    return {
      name,
      command: [command, ...args].join(' '),
      status: result.status ?? 1,
      json: null,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  }
}

function readState() {
  if (!existsSync(statePath)) return null;
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return {
      error: `状態ファイルを解析できません: ${statePath}`,
    };
  }
}

function buildVerdict({ evaluation, discovery, persistedState }) {
  const reasons = [];
  const requiredActions = [];
  const evaluatorChecks = [];

  const loopDecision = evaluation?.decision;
  if (!loopDecision) {
    reasons.push('loop-evaluate の判定を取得できませんでした。');
    requiredActions.push('npm run loop:evaluate を直接確認してください。');
    evaluatorChecks.push({ name: 'loop-evaluate', result: 'reject' });
  } else {
    evaluatorChecks.push({ name: 'loop-evaluate', result: loopDecision.status });
    if (loopDecision.status === 'stop') {
      reasons.push(loopDecision.reason);
      requiredActions.push(loopDecision.nextAction);
    }
  }

  const findings = discovery?.findings ?? [];
  const stopFindings = findings.filter((finding) => finding.severity === 'stop');
  const warnFindings = findings.filter((finding) => finding.severity === 'warn');

  evaluatorChecks.push({
    name: 'loop-discover',
    result: stopFindings.length > 0 ? 'stop' : warnFindings.length > 0 ? 'warn' : 'pass',
  });

  for (const finding of stopFindings) {
    reasons.push(`${finding.title}: ${finding.description}`);
    requiredActions.push(finding.nextAction);
  }

  if (persistedState?.error) {
    reasons.push(persistedState.error);
    requiredActions.push('状態ファイルを削除または修正してから再評価してください。');
    evaluatorChecks.push({ name: 'state-file', result: 'reject' });
  } else if (persistedState) {
    const openStop = (persistedState.findings ?? []).filter(
      (finding) => finding.status !== 'resolved' && finding.severity === 'stop',
    );
    evaluatorChecks.push({
      name: 'state-file',
      result: openStop.length > 0 ? 'stop' : 'pass',
    });

    for (const finding of openStop) {
      reasons.push(`未解決の停止事項があります: ${finding.title}`);
      requiredActions.push(finding.nextAction);
    }
  } else {
    evaluatorChecks.push({ name: 'state-file', result: 'not-written' });
  }

  if (reasons.length > 0) {
    return {
      status: 'stop',
      reason: reasons[0],
      requiredActions: [...new Set(requiredActions.filter(Boolean))],
      evaluatorChecks,
    };
  }

  if (loopDecision?.status === 'warn' || warnFindings.length > 0) {
    return {
      status: 'warn',
      reason: '独立評価は続行可能ですが、警告があります。',
      requiredActions: [
        ...new Set([
          loopDecision?.status === 'warn' ? loopDecision.nextAction : null,
          ...warnFindings.map((finding) => finding.nextAction),
        ].filter(Boolean)),
      ],
      evaluatorChecks,
    };
  }

  return {
    status: 'pass',
    reason: '独立評価で停止事項は見つかりませんでした。',
    requiredActions: [],
    evaluatorChecks,
  };
}

function buildReport() {
  const evaluationResult = runJson('loop-evaluate', 'node', ['scripts/loop-evaluate.mjs', '--json']);
  const discoveryResult = runJson('loop-discover', 'node', ['scripts/loop-discover.mjs', '--json']);
  const persistedState = readState();
  const verdict = buildVerdict({
    evaluation: evaluationResult.json,
    discovery: discoveryResult.json,
    persistedState,
  });

  return {
    generatedAt: new Date().toISOString(),
    stance: '証明されるまで壊れている前提で、生成役とは別視点から評価する。',
    verdict,
    evaluation: evaluationResult.json,
    discovery: discoveryResult.json,
    state: persistedState
      ? {
          path: statePath,
          summary: persistedState.summary ?? null,
          error: persistedState.error ?? null,
        }
      : {
          path: statePath,
          summary: null,
          error: null,
        },
  };
}

function printHuman(report) {
  console.log('[loop:evaluator] 独立評価結果');
  console.log(`status: ${report.verdict.status}`);
  console.log(`reason: ${report.verdict.reason}`);
  console.log('');
  console.log('checks:');
  for (const check of report.verdict.evaluatorChecks) {
    console.log(`- ${check.name}: ${check.result}`);
  }

  console.log('');
  console.log('required actions:');
  if (report.verdict.requiredActions.length === 0) {
    console.log('- なし');
  } else {
    for (const action of report.verdict.requiredActions) {
      console.log(`- ${action}`);
    }
  }
}

const report = buildReport();

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHuman(report);
}

if (report.verdict.status === 'stop') {
  process.exit(1);
}
