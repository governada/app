import { existsSync } from 'node:fs';
import path from 'node:path';
import { CODEX_RUNTIME_ENV_KEYS, getMissingRuntimeEnv } from './lib/codex-runtime-env.mjs';

const repoRoot = process.cwd();
const missingRuntimeEnv = getMissingRuntimeEnv(process.env);
const userAgent = process.env.npm_config_user_agent ?? 'unknown';
const npmVersionMatch = userAgent.match(/\bnpm\/([^\s]+)/);
const npmVersion = npmVersionMatch ? npmVersionMatch[1] : 'unknown';

console.log('=== Codex Cloud Doctor ===');
console.log(`Repo: ${repoRoot}`);
console.log(`Platform: ${process.platform}`);
console.log(`Node: ${process.version}`);
console.log(`npm: ${npmVersion}`);
console.log(`package-lock.json: ${existsSync(path.join(repoRoot, 'package-lock.json')) ? 'present' : 'missing'}`);
console.log(`node_modules: ${existsSync(path.join(repoRoot, 'node_modules')) ? 'present' : 'missing'}`);
console.log('');
console.log('Recommended review verification: npm run codex:verify');
console.log('Recommended full review verification: npm run codex:review-check');
console.log('Recommended runtime verification: npm run codex:runtime-check');
console.log('Required runtime env for app boot:');

for (const key of CODEX_RUNTIME_ENV_KEYS) {
  const status = process.env[key] ? 'set' : 'missing';
  console.log(`- ${key}: ${status}`);
}

if (missingRuntimeEnv.length > 0) {
  console.log('');
  console.log('Status: review-ready environment only. Runtime boot will need additional env vars.');
} else {
  console.log('');
  console.log('Status: required runtime env vars are present.');
}
