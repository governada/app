import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { getSharedCheckoutRoot } from './env-bootstrap.mjs';
import { redactSensitiveText } from './github-app-auth.mjs';

const BROKER_SOCKET_ROOT = '/tmp';

export function githubBrokerSocketPath(repoRoot, _env = process.env) {
  return defaultGithubBrokerSocketPath(repoRoot);
}

function defaultGithubBrokerSocketPath(repoRoot) {
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'nouid';
  const repoHash = createHash('sha256')
    .update(path.resolve(canonicalGithubBrokerRoot(repoRoot)))
    .digest('hex')
    .slice(0, 16);
  return path.join(BROKER_SOCKET_ROOT, `gov-gh-${uid}`, `${repoHash}.sock`);
}

function canonicalGithubBrokerRoot(repoRoot) {
  try {
    return getSharedCheckoutRoot(repoRoot) || repoRoot;
  } catch {
    return repoRoot;
  }
}

export function isGithubBrokerAvailable(repoRoot, env = process.env) {
  return existsSync(githubBrokerSocketPath(repoRoot, env));
}

export function callGithubBroker({ env = process.env, repoRoot, request, timeoutMs = 15000 }) {
  const socketPath = githubBrokerSocketPath(repoRoot, env);

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`GitHub broker timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    let responseText = '';

    socket.setEncoding('utf8');
    socket.on('connect', () => {
      socket.write(`${JSON.stringify(request)}\n`);
    });
    socket.on('data', (chunk) => {
      responseText += chunk;
    });
    socket.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(redactSensitiveText(`GitHub broker connection failed: ${error.message}`)));
    });
    socket.on('end', () => {
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(responseText));
      } catch {
        reject(new Error('GitHub broker returned malformed JSON'));
      }
    });
  });
}
