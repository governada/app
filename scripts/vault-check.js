const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { repoRoot } = require('./lib/runtime');

function getSharedCheckoutRoot() {
  const result = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (result.status !== 0) {
    return '';
  }

  const commonDir = result.stdout.trim();
  return commonDir ? path.dirname(commonDir) : '';
}

const sharedCheckoutRoot = getSharedCheckoutRoot();
const vaultRoot = path.resolve(sharedCheckoutRoot || repoRoot, '..', 'governada-brain');
const ignoredDirs = new Set(['.obsidian']);
const requiredTemplates = [
  'templates/daily.md',
  'templates/decision.md',
  'templates/note.md',
  'templates/runbook.md',
  'templates/incident.md',
  'templates/system-note.md',
];

function walkMarkdownFiles(root) {
  const files = [];

  function walk(current) {
    if (!fs.existsSync(current)) {
      return;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirs.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files.sort();
}

function toVaultKey(filePath) {
  return path.relative(vaultRoot, filePath).split(path.sep).join('/').replace(/\.md$/u, '');
}

function parseWikilinks(content) {
  return [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1]);
}

function normalizeLinkTarget(rawTarget) {
  const beforeAlias = rawTarget.split('|')[0] || '';
  const beforeHeading = beforeAlias.split('#')[0] || '';
  return beforeHeading.trim().replace(/\\/g, '/').replace(/\.md$/u, '').replace(/^\/+/u, '');
}

function checkTemplateFrontmatter(templatePath) {
  const content = fs.readFileSync(templatePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/u);
  if (!match) {
    return { ok: false, detail: 'missing frontmatter block' };
  }

  if (!/^type:\s+\S+/mu.test(match[1])) {
    return { ok: false, detail: 'frontmatter is missing type' };
  }

  return { ok: true, detail: 'frontmatter includes type' };
}

function main() {
  if (!fs.existsSync(vaultRoot)) {
    console.error(`Vault check failed: sibling vault not found at ${vaultRoot}`);
    process.exit(1);
  }

  const markdownFiles = walkMarkdownFiles(vaultRoot);
  const pathIndex = new Map();
  const basenameIndex = new Map();

  for (const filePath of markdownFiles) {
    const key = toVaultKey(filePath);
    pathIndex.set(key, filePath);

    const basename = path.posix.basename(key);
    const matches = basenameIndex.get(basename) || [];
    matches.push(key);
    basenameIndex.set(basename, matches);
  }

  const broken = [];
  const ambiguous = [];
  let totalLinks = 0;

  for (const filePath of markdownFiles) {
    const fileKey = toVaultKey(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    for (const rawTarget of parseWikilinks(content)) {
      const target = normalizeLinkTarget(rawTarget);
      if (!target) {
        continue;
      }

      totalLinks += 1;

      if (target.includes('/')) {
        if (!pathIndex.has(target)) {
          broken.push(`${fileKey} -> [[${rawTarget}]]`);
        }
        continue;
      }

      const matches = basenameIndex.get(target) || [];
      if (matches.length === 0) {
        broken.push(`${fileKey} -> [[${rawTarget}]]`);
      } else if (matches.length > 1) {
        ambiguous.push(`${fileKey} -> [[${rawTarget}]] (${matches.join(', ')})`);
      }
    }
  }

  const templateChecks = requiredTemplates.map((relativePath) => {
    const fullPath = path.join(vaultRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      return { ok: false, label: relativePath, detail: 'missing template file' };
    }

    const check = checkTemplateFrontmatter(fullPath);
    return { ok: check.ok, label: relativePath, detail: check.detail };
  });

  console.log('=== Vault Check ===');
  console.log(`Vault: ${vaultRoot}`);
  console.log(`Markdown files: ${markdownFiles.length}`);
  console.log(`Wikilinks checked: ${totalLinks}`);
  console.log(`Broken links: ${broken.length}`);
  console.log(`Ambiguous links: ${ambiguous.length}`);
  console.log('');
  console.log('Template checks:');
  for (const result of templateChecks) {
    console.log(`[${result.ok ? 'OK' : 'WARN'}] ${result.label}: ${result.detail}`);
  }

  if (broken.length > 0) {
    console.log('');
    console.log('Broken wikilinks:');
    for (const item of broken) {
      console.log(`- ${item}`);
    }
  }

  if (ambiguous.length > 0) {
    console.log('');
    console.log('Ambiguous wikilinks:');
    for (const item of ambiguous) {
      console.log(`- ${item}`);
    }
  }

  const hasTemplateProblems = templateChecks.some((result) => !result.ok);
  if (broken.length > 0 || ambiguous.length > 0 || hasTemplateProblems) {
    process.exit(1);
  }

  console.log('');
  console.log('Vault link and template checks passed.');
}

if (require.main === module) {
  main();
}
