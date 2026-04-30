#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const { repoRoot, runCommand } = require('./lib/runtime');

const CANONICAL_REMOTE = 'git@github-governada:governada/app.git';
const EXPECTED_USER = 'tim-governada';

function firstLine(text) {
  return (
    text
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean) || ''
  );
}

function outputOf(result) {
  return [result.stdout, result.stderr, result.error?.message || '']
    .filter(Boolean)
    .join('\n')
    .trim();
}

function resolveSshPath(value) {
  if (!value || value === 'none') {
    return '';
  }

  if (value.startsWith('~/')) {
    return path.join(process.env.HOME || '', value.slice(2));
  }

  return value;
}

function printRemediation() {
  console.error('');
  console.error('Remediation:');
  console.error('- Enable and unlock the 1Password SSH agent.');
  console.error('- Verify: ssh -T git@github-governada');
  console.error(`- Confirm origin is ${CANONICAL_REMOTE}.`);
}

function main() {
  const failures = [];

  console.log('GitHub auth: SSH + 1Password probe');

  const remote = runCommand('git', ['remote', 'get-url', 'origin'], { cwd: repoRoot });
  const remoteUrl = remote.stdout.trim();
  if (remote.status === 0 && remoteUrl === CANONICAL_REMOTE) {
    console.log(`OK: origin remote is ${CANONICAL_REMOTE}`);
  } else {
    failures.push(`origin remote is ${remoteUrl || '(missing)'}, expected ${CANONICAL_REMOTE}`);
  }

  const config = runCommand('ssh', ['-G', 'github-governada'], { cwd: repoRoot, timeoutMs: 5000 });
  if (config.status === 0) {
    const lines = config.stdout.split(/\r?\n/u);
    const identityAgentLine = lines.find((line) => line.toLowerCase().startsWith('identityagent '));
    const identityAgent = resolveSshPath(
      identityAgentLine ? identityAgentLine.slice('identityagent '.length).trim() : '',
    );
    if (identityAgent) {
      console.log(
        `OK: github-governada IdentityAgent ${fs.existsSync(identityAgent) ? 'exists' : 'configured'}`,
      );
    } else {
      failures.push('github-governada IdentityAgent is not configured');
    }
  } else {
    failures.push(
      `ssh config probe failed: ${firstLine(outputOf(config)) || `exit ${config.status}`}`,
    );
  }

  const ssh = runCommand(
    'ssh',
    ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'git@github-governada'],
    { cwd: repoRoot, timeoutMs: 15000 },
  );
  const sshOutput = outputOf(ssh);
  if (
    sshOutput.includes('successfully authenticated') &&
    (!sshOutput.includes('Hi ') || sshOutput.includes(`Hi ${EXPECTED_USER}`))
  ) {
    console.log(`OK: SSH authenticates as ${EXPECTED_USER}`);
  } else {
    failures.push(`SSH auth probe failed: ${firstLine(sshOutput) || `exit ${ssh.status}`}`);
  }

  const remoteRead = runCommand('git', ['ls-remote', '--exit-code', 'origin', 'refs/heads/main'], {
    cwd: repoRoot,
    timeoutMs: 15000,
  });
  if (remoteRead.status === 0) {
    console.log('OK: git can read origin/main over SSH');
  } else {
    failures.push(
      `git remote read failed: ${firstLine(outputOf(remoteRead)) || `exit ${remoteRead.status}`}`,
    );
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`BLOCKED: ${failure}`);
    }
    printRemediation();
    process.exit(1);
  }

  console.log('GitHub auth result: OK');
}

main();
