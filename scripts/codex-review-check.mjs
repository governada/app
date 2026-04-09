#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const steps = [
  {
    label: 'lint',
    command: 'npm run lint',
    args: [fileURLToPath(new URL('../node_modules/eslint/bin/eslint.js', import.meta.url)), '--cache'],
  },
  {
    label: 'type-check',
    command: 'npm run type-check',
    args: [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)), '--noEmit'],
  },
  {
    label: 'test:unit',
    command: 'npm run test:unit',
    args: [
      fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
      'run',
      '--project',
      'unit',
    ],
  },
];

for (const step of steps) {
  console.log(`Running ${step.label}...`);

  const result =
    process.platform === 'win32'
      ? spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', step.command], {
          cwd: process.cwd(),
          env: process.env,
          stdio: 'inherit',
          shell: false,
        })
      : spawnSync(process.execPath, step.args, {
          cwd: process.cwd(),
          env: process.env,
          stdio: 'inherit',
          shell: false,
        });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
