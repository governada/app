import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  validateInngestServeMethods,
  validateRouteRenderContract,
} from './lib/agentConstraints.mjs';

const root = process.cwd();
const errors = [];

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function parseLocalBindings(importClause) {
  const bindings = [];
  const namedMatches = [...importClause.matchAll(/\{([\s\S]*?)\}/g)];

  for (const match of namedMatches) {
    for (const rawPart of match[1].split(',')) {
      const part = rawPart.trim();
      if (!part) continue;
      const [, localName] = part.split(/\s+as\s+/).map((token) => token.trim());
      bindings.push(localName || part);
    }
  }

  const defaultClause = importClause
    .replace(/\{[\s\S]*?\}/g, '')
    .trim()
    .replace(/,$/, '')
    .trim();
  if (defaultClause && defaultClause !== '*') {
    for (const part of defaultClause.split(',')) {
      const candidate = part.trim();
      if (candidate) bindings.push(candidate);
    }
  }

  return bindings;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateRouteRenderPolicy() {
  const appDir = path.join(root, 'app');
  const routeFiles = walk(appDir).filter((file) => /[\\/](layout|page|route)\.tsx?$/.test(file));

  for (const file of routeFiles) {
    const content = readFileSync(file, 'utf8');
    errors.push(...validateRouteRenderContract(toPosix(path.relative(root, file)), content));
  }
}

function validateInngestRegistration() {
  const routePath = path.join(root, 'app', 'api', 'inngest', 'route.ts');
  const functionDir = path.join(root, 'inngest', 'functions');
  const routeContent = readFileSync(routePath, 'utf8');
  const routeImports = new Map();
  const importPattern = /import\s+([\s\S]*?)\s+from\s+['"]@\/inngest\/functions\/([^'"]+)['"];?/g;
  const functionsArrayMatch = routeContent.match(/functions:\s*\[([\s\S]*?)\]\s*,\s*\}\);/);
  const registeredFunctions = functionsArrayMatch ? functionsArrayMatch[1] : '';

  for (const match of routeContent.matchAll(importPattern)) {
    routeImports.set(match[2], parseLocalBindings(match[1]));
  }

  const functionFiles = readdirSync(functionDir)
    .filter((name) => name.endsWith('.ts'))
    .sort();

  for (const filename of functionFiles) {
    const fileKey = filename.replace(/\.ts$/, '');
    const localBindings = routeImports.get(fileKey);

    if (!localBindings) {
      errors.push(`inngest/functions/${filename}: not imported in app/api/inngest/route.ts.`);
      continue;
    }

    const isReferenced = localBindings.some((binding) =>
      new RegExp(`\\b${escapeRegex(binding)}\\b`).test(registeredFunctions),
    );
    if (!isReferenced) {
      errors.push(
        `inngest/functions/${filename}: imported in app/api/inngest/route.ts but not registered in the functions array.`,
      );
    }
  }

  errors.push(...validateInngestServeMethods('app/api/inngest/route.ts', routeContent));
}

function validateRequiredFiles() {
  const required = [
    path.join(root, '.claude', 'settings.json'),
    path.join(root, 'app', 'api', 'inngest', 'route.ts'),
    path.join(root, 'inngest', 'functions'),
  ];

  for (const target of required) {
    if (!existsSync(target)) {
      errors.push(
        `${toPosix(path.relative(root, target))}: required file or directory is missing.`,
      );
    }
  }
}

function validateRepoIdentityReferences() {
  const activeRoots = [
    '.claude/commands',
    '.claude/hooks',
    '.claude/skills',
    '.cursor/commands',
    '.cursor/rules',
    '.github/runner',
    'AGENTS.md',
    'scripts',
  ];
  const stalePatterns = [
    /governada\/governada-app/u,
    /github-governada:governada\/governada-app/u,
    /repos\/governada\/governada-app/u,
    /gh auth switch --user governada\b/u,
    /must show governada\b/iu,
    /Verify gh auth \(governada\)/u,
  ];

  for (const activeRoot of activeRoots) {
    const absoluteRoot = path.join(root, activeRoot);
    if (!existsSync(absoluteRoot)) {
      continue;
    }

    const targets = statSync(absoluteRoot).isDirectory() ? walk(absoluteRoot) : [absoluteRoot];

    for (const file of targets) {
      const relativeFile = toPosix(path.relative(root, file));
      if (relativeFile === 'scripts/validate-agent-constraints.mjs') {
        continue;
      }

      const content = readFileSync(file, 'utf8');
      const stalePattern = stalePatterns.find((pattern) => pattern.test(content));
      if (stalePattern) {
        errors.push(
          `${relativeFile}: stale Governada repo identity reference found (${stalePattern.source}).`,
        );
      }
    }
  }
}

validateRequiredFiles();

if (errors.length === 0) {
  validateRepoIdentityReferences();
  validateRouteRenderPolicy();
  validateInngestRegistration();
}

if (errors.length > 0) {
  console.error('Agent constraint validation failed:\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Agent constraint validation passed.');
