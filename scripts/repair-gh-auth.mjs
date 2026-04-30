#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const result = spawnSync(process.execPath, [path.join(scriptDir, 'gh-auth-status.js')], {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status === 0) {
  process.exit(0);
}

console.error('');
console.error('Auth repair hint: this repo now uses only SSH + 1Password for git.');
console.error('1. Open 1Password and ensure Developer -> SSH agent is enabled.');
console.error('2. Run: ssh -T git@github-governada');
console.error('3. Run: git remote get-url origin');
console.error('4. Expected remote: git@github-governada:governada/app.git');
console.error('No GitHub token, Keychain cache, LaunchAgent, or broker repair is attempted.');

process.exit(result.status ?? 1);
