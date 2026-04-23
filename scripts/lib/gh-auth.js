const { spawnSync } = require('node:child_process');

function readOnePasswordToken(tokenRef, env, cwd) {
  const result = spawnSync('op', ['read', tokenRef], {
    cwd,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error?.code === 'ENOENT') {
    return {
      error: 'GitHub auth: GH_TOKEN_OP_REF is set, but the 1Password CLI (`op`) is not installed.',
    };
  }

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    return {
      error:
        `GitHub auth: could not read GH_TOKEN_OP_REF with 1Password CLI.` +
        (detail ? `\n${detail}` : ''),
    };
  }

  const token = result.stdout.trim();
  if (!token) {
    return { error: 'GitHub auth: GH_TOKEN_OP_REF resolved to an empty value.' };
  }

  return { token };
}

function withGhTokenFromOnePassword(env, cwd) {
  const mergedEnv = { ...env };
  const tokenRef = mergedEnv.GH_TOKEN_OP_REF || mergedEnv.GITHUB_TOKEN_OP_REF;

  if (!tokenRef || mergedEnv.GH_TOKEN || mergedEnv.GITHUB_TOKEN) {
    return { env: mergedEnv };
  }

  const result = readOnePasswordToken(tokenRef, mergedEnv, cwd);
  if (result.error) {
    return { env: mergedEnv, error: result.error };
  }

  mergedEnv.GH_TOKEN = result.token;
  return { env: mergedEnv };
}

module.exports = {
  withGhTokenFromOnePassword,
};
