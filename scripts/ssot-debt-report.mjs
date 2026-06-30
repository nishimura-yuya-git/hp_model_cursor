#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const jsonMode = process.argv.includes('--json');

function classifyArea(file) {
  if (file.includes('/SalesRecords/')) return 'SalesRecords';
  if (file.includes('/SalesInput/')) return 'SalesInput';
  if (file.includes('/Settlement/')) return 'Settlement';
  if (file.includes('/MySalary/')) return 'MySalary';
  if (file.includes('/SalesPayrollSummary/')) return 'SalesPayrollSummary';
  if (file.includes('/Inventory/')) return 'Inventory';
  if (file.includes('/Rankings/')) return 'Rankings';
  if (file.includes('/components/')) return 'Components';
  return 'Other';
}

function parseViolations(output) {
  const lines = output.split('\n');
  const violations = [];
  let current = null;

  for (const line of lines) {
    const header = line.match(/(?:ERROR|WARN).*?\[(SSOT-\d+)\]\s+([^:\s]+):(\d+)/);
    if (header) {
      current = {
        patternId: header[1],
        file: header[2],
        line: Number(header[3]),
        severity: line.includes('WARN') ? 'warn' : 'error',
        area: classifyArea(header[2]),
      };
      violations.push(current);
      continue;
    }

    if (!current) continue;

    const message = line.match(/^\s{8}(.+?)$/);
    if (message && !current.message && !line.includes('>') && !line.includes('💡')) {
      current.message = message[1].trim();
      continue;
    }

    const code = line.match(/^\s+>\s+(.+)$/);
    if (code) {
      current.code = code[1].trim();
      continue;
    }

    const hint = line.match(/💡\s+(.+)$/);
    if (hint) {
      current.hint = hint[1].trim();
    }
  }

  return violations;
}

function buildSummary(violations) {
  const areas = new Map();
  for (const violation of violations) {
    const current = areas.get(violation.area) ?? { area: violation.area, total: 0, errors: 0, warnings: 0 };
    current.total += 1;
    if (violation.severity === 'error') current.errors += 1;
    if (violation.severity === 'warn') current.warnings += 1;
    areas.set(violation.area, current);
  }

  const priority = [...areas.values()].sort((a, b) => {
    if (a.errors !== b.errors) return b.errors - a.errors;
    return b.total - a.total;
  });

  return {
    total: violations.length,
    errors: violations.filter((violation) => violation.severity === 'error').length,
    warnings: violations.filter((violation) => violation.severity === 'warn').length,
    priority,
  };
}

function printHuman(report) {
  console.log('[ssot-debt] SSoT Debt Report');
  console.log(`total: ${report.summary.total}`);
  console.log(`errors: ${report.summary.errors}`);
  console.log(`warnings: ${report.summary.warnings}`);

  console.log('');
  console.log('areas:');
  if (report.summary.priority.length === 0) {
    console.log('- なし');
  } else {
    for (const area of report.summary.priority) {
      console.log(`- ${area.area}: total=${area.total}, error=${area.errors}, warn=${area.warnings}`);
    }
  }

  console.log('');
  console.log('recommended first targets:');
  for (const violation of report.violations.slice(0, 5)) {
    console.log(`- ${violation.file}:${violation.line} [${violation.patternId}] ${violation.severity}`);
    if (violation.code) console.log(`  ${violation.code}`);
  }
}

const result = spawnSync('npm', ['run', 'check:ssot'], {
  encoding: 'utf8',
  shell: false,
});

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const violations = parseViolations(output);
const report = {
  generatedAt: new Date().toISOString(),
  checkStatus: result.status ?? 1,
  summary: buildSummary(violations),
  violations,
};

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHuman(report);
}
