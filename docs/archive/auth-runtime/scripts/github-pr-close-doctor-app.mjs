import { createRequire } from 'node:module';

import {
  findEnvLocalKeyDefinitions,
  findFirstExisting,
  getEnvRefsCandidates,
  getForbiddenGithubReferenceKeys,
  parseEnvEntries,
} from './lib/env-bootstrap.mjs';
import {
  EXPECTED_REPO,
  FORBIDDEN_GITHUB_APP_LOCAL_ENV_KEYS,
  GITHUB_APP_LOCAL_ENV_KEYS,
  GITHUB_OPERATION_CLASSES,
  GITHUB_READ_ENV_KEYS,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS,
  getGithubReadLaneConfig,
  isValidOpReference,
  redactSensitiveText,
} from './lib/github-app-auth.mjs';
import { getGithubBrokerStatus } from './lib/github-broker-service.mjs';
import { evaluateGithubPrCloseBrokerStatus } from './lib/github-pr-close.mjs';
import { getScriptContext, loadLocalEnv } from './lib/runtime.mjs';

const require = createRequire(import.meta.url);
const { getContext } = require('./set-gh-context.js');

const EXPECTED_OP_ACCOUNT = 'my.1password.com';
const GITHUB_PR_CLOSE_REF_KEYS = new Set([
  GITHUB_READ_ENV_KEYS.appId,
  GITHUB_READ_ENV_KEYS.installationId,
  GITHUB_READ_ENV_KEYS.privateKeyRef,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter,
]);

function pass(message) {
  console.log(`OK: ${message}`);
}

function advisory(advisories, message) {
  advisories.push(message);
  console.log(`ADVISORY: ${message}`);
}

function block(blockers, message) {
  blockers.push(message);
  console.log(`BLOCKED: ${message}`);
}

async function main() {
  const blockers = [];
  const advisories = [];
  const { repoRoot } = getScriptContext(import.meta.url);
  const forbiddenEnvLocalDefinitions = findEnvLocalKeyDefinitions(
    repoRoot,
    FORBIDDEN_GITHUB_APP_LOCAL_ENV_KEYS,
  );
  loadLocalEnv(import.meta.url, GITHUB_APP_LOCAL_ENV_KEYS);
  const refsPath = loadGithubPrCloseReferenceEnv(repoRoot);

  const context = getContext();
  const env = {
    ...process.env,
    ...context,
  };
  const config = getGithubReadLaneConfig(env);

  console.log('GitHub PR close doctor: app-local compatibility fallback');
  console.log('Capability: github.app.installation.governada.pilot');
  console.log(`Operation class: ${GITHUB_OPERATION_CLASSES.prClose}`);
  console.log('Mutation policy: no PR read or close endpoint is called by this doctor');
  console.log('Live execution path: npm run github:pr-close remains broker-backed');

  if (refsPath) {
    pass(
      `.env.local.refs was inspected for ${GITHUB_OPERATION_CLASSES.prClose} reference metadata without resolving values`,
    );

    const forbiddenRefsKeys = getForbiddenGithubReferenceKeys(refsPath);
    if (forbiddenRefsKeys.length > 0) {
      block(
        blockers,
        `.env.local.refs must not define ${forbiddenRefsKeys.join(', ')} for the autonomous PR close lane`,
      );
    }
  } else {
    advisory(
      advisories,
      '.env.local.refs is absent; PR close lane metadata may only come from process env',
    );
  }

  if (forbiddenEnvLocalDefinitions.length > 0) {
    block(
      blockers,
      `.env.local must not define ${describeEnvLocalDefinitions(forbiddenEnvLocalDefinitions)} for the autonomous PR close lane`,
    );
  }

  if (context.GH_REPO === EXPECTED_REPO) {
    pass(`repo context is pinned to ${EXPECTED_REPO}`);
  } else {
    block(blockers, `repo context is ${context.GH_REPO || 'unset'}, expected ${EXPECTED_REPO}`);
  }

  if (context.OP_ACCOUNT === EXPECTED_OP_ACCOUNT) {
    pass(`1Password account is pinned to ${EXPECTED_OP_ACCOUNT}`);
  } else {
    block(
      blockers,
      `1Password account is ${context.OP_ACCOUNT || 'unset'}, expected ${EXPECTED_OP_ACCOUNT}`,
    );
  }

  if (config.rawGithubTokenKeys.length > 0) {
    block(
      blockers,
      `raw ${config.rawGithubTokenKeys.join('/')} env is present; autonomous ${GITHUB_OPERATION_CLASSES.prClose} must not use human or raw GitHub tokens`,
    );
  } else {
    pass('raw GitHub token env is not present');
  }

  if (config.opConnectKeys.length > 0) {
    block(
      blockers,
      `${config.opConnectKeys.join('/')} is present; clear 1Password Connect env before proving the service-account lane`,
    );
  } else {
    pass('1Password Connect env is not present');
  }

  if (config.privateKeyRef && isValidOpReference(config.privateKeyRef)) {
    pass(`${GITHUB_READ_ENV_KEYS.privateKeyRef} is an op:// reference`);
  } else if (config.privateKeyRef) {
    block(blockers, `${GITHUB_READ_ENV_KEYS.privateKeyRef} must be an op:// reference`);
  }

  const status = await getGithubBrokerStatus({ env, repoRoot });
  const evaluation = evaluateGithubPrCloseBrokerStatus(status);
  for (const message of evaluation.passes) {
    pass(message);
  }
  for (const message of evaluation.blockers) {
    advisory(advisories, `compatibility fallback status not live-proven: ${message}`);
  }

  advisory(
    advisories,
    'This doctor proves app-local PR close fallback wiring only. Target-PR dry-runs and live closes still require npm run github:pr-close with expected-head proof; live mode also requires exact Tim approval.',
  );
  advisory(
    advisories,
    'Comments, labels, branch deletion, ready-state transitions, merge, deploy mutation, production sync, secret changes, billing/admin, branch protection, and credential rotation remain separately gated.',
  );

  writeResult(blockers, advisories);
  process.exit(blockers.length > 0 ? 1 : 0);
}

function writeResult(blockers, advisories) {
  console.log('');
  if (blockers.length > 0) {
    console.log(`GitHub PR close doctor result: BLOCKED (${blockers.length})`);
    return;
  }

  if (advisories.length > 0) {
    console.log(`GitHub PR close doctor result: PASS_WITH_ADVISORIES (${advisories.length})`);
    return;
  }

  console.log('GitHub PR close doctor result: OK');
}

function describeEnvLocalDefinitions(definitions) {
  return definitions.map((definition) => `${definition.key} (${definition.filePath})`).join(', ');
}

function loadGithubPrCloseReferenceEnv(repoRoot) {
  const refsPath = findFirstExisting(getEnvRefsCandidates(repoRoot));
  if (!refsPath) {
    return '';
  }

  for (const entry of parseEnvEntries(refsPath)) {
    if (GITHUB_PR_CLOSE_REF_KEYS.has(entry.key) && process.env[entry.key] === undefined) {
      process.env[entry.key] = entry.value;
    }
  }

  return refsPath;
}

main().catch((error) => {
  console.error(`BLOCKED: ${redactSensitiveText(error?.message || String(error))}`);
  console.error('');
  console.error('GitHub PR close doctor result: BLOCKED (1)');
  process.exit(1);
});
