#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const [, , tool, ...args] = process.argv;

const tools = {
  'gh:auth-status': {
    win32: ['powershell', ['-ExecutionPolicy', 'Bypass', '-File', 'gh-auth-status.ps1']],
    default: [process.execPath, ['gh-auth-status.js']],
  },
  'auth:repair': {
    win32: ['powershell', ['-ExecutionPolicy', 'Bypass', '-File', 'repair-gh-auth.ps1']],
    default: [process.execPath, ['repair-gh-auth.mjs']],
  },
  'session:doctor': {
    win32: ['powershell', ['-ExecutionPolicy', 'Bypass', '-File', 'session-doctor.ps1']],
    default: [process.execPath, ['session-doctor.js']],
  },
  'worktree:new': {
    win32: ['powershell', ['-ExecutionPolicy', 'Bypass', '-File', 'new-worktree.ps1']],
    default: [process.execPath, ['new-worktree.mjs']],
  },
  'worktree:sync': {
    win32: ['powershell', ['-ExecutionPolicy', 'Bypass', '-File', 'sync-worktree.ps1']],
    default: [process.execPath, ['sync-worktree.mjs']],
  },
};

function wantsHelp(values) {
  return values.includes('--help') || values.includes('-h');
}

if (!tool || !(tool in tools)) {
  console.error(
    `Usage: node scripts/run-local-tool.mjs <${Object.keys(tools).join('|')}> [args...]`,
  );
  process.exit(1);
}

const entry = tools[tool];
const selectedEntry =
  process.platform === 'win32' && tool === 'worktree:new' && wantsHelp(args)
    ? entry.default
    : (entry[process.platform] ?? entry.default);
const [command, baseArgs] = selectedEntry;
const resolvedArgs = baseArgs.map((value) =>
  value.endsWith('.ps1') || value.endsWith('.js') || value.endsWith('.mjs')
    ? path.join(scriptDir, value)
    : value,
);

const result = spawnSync(command, [...resolvedArgs, ...args], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
