#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { assertRuntimeEnv } from './lib/codex-runtime-env.mjs';

try {
  assertRuntimeEnv(process.env);
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}

console.log('Runtime environment variables: OK');
console.log('Running production build...');

const command = process.execPath;
const args = process.env.npm_execpath
  ? [process.env.npm_execpath, 'run', 'build']
  : ['node_modules/next/dist/bin/next', 'build', '--turbopack'];
const disableRemoteFonts = process.env.GOVERNADA_DISABLE_REMOTE_FONTS ?? '1';
const buildEnv = {
  ...process.env,
  GOVERNADA_DISABLE_REMOTE_FONTS: disableRemoteFonts,
};

if (disableRemoteFonts === '1') {
  buildEnv.NEXT_FONT_GOOGLE_MOCKED_RESPONSES =
    process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES ??
    fileURLToPath(new URL('./codex-font-mocks.cjs', import.meta.url));
}

const result = spawnSync(command, args, {
  cwd: process.cwd(),
  env: buildEnv,
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
