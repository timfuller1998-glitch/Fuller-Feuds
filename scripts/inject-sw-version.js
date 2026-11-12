#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function gitSha() {
  const fromEnv = process.env.RENDER_GIT_COMMIT || process.env.SOURCE_VERSION || process.env.FF_BUILD_SHA;
  if (fromEnv) return fromEnv.trim();
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8'));
const packageVersion = packageJson.version || '1.0.0';
const sha = gitSha();
const shortSha = sha.slice(0, 7);
const builtAt = new Date().toISOString();
const cacheVersion = `fuller-feuds-${packageVersion}-${shortSha}`;
const runtimeCacheVersion = `fuller-feuds-runtime-${packageVersion}-${shortSha}`;

const sourcePath = path.resolve(__dirname, '..', 'public', 'service-worker.js');
const targetPath = path.resolve(__dirname, '..', 'dist', 'public', 'service-worker.js');
const indexPath = path.resolve(__dirname, '..', 'dist', 'public', 'index.html');
const versionPath = path.resolve(__dirname, '..', 'dist', 'public', 'version.json');

if (!fs.existsSync(sourcePath)) {
  console.error(`[Inject SW Version] Source file does not exist: ${sourcePath}`);
  process.exit(1);
}

let swContent = fs.readFileSync(sourcePath, 'utf-8');
swContent = swContent
  .replace(/const CACHE_NAME = '{{CACHE_VERSION}}';/g, `const CACHE_NAME = '${cacheVersion}';`)
  .replace(/const RUNTIME_CACHE = '{{RUNTIME_CACHE_VERSION}}';/g, `const RUNTIME_CACHE = '${runtimeCacheVersion}';`);

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, swContent, 'utf-8');

const version = { sha, shortSha, builtAt, version: packageVersion };
fs.writeFileSync(versionPath, JSON.stringify(version, null, 2), 'utf-8');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf-8');
  const meta = `<meta name="ff-build" content="${shortSha}" />\n    <meta name="ff-built-at" content="${builtAt}" />`;
  if (html.includes('name="ff-build"')) {
    html = html.replace(/<meta name="ff-build"[^>]*>/, `<meta name="ff-build" content="${shortSha}" />`);
    html = html.replace(/<meta name="ff-built-at"[^>]*>/, `<meta name="ff-built-at" content="${builtAt}" />`);
  } else {
    html = html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${meta}`);
  }
  html = html.replace(
    '</head>',
    `<script>window.__FF_BUILD__=${JSON.stringify(version)};</script>\n  </head>`
  );
  fs.writeFileSync(indexPath, html, 'utf-8');
}

console.log(`[Inject SW Version] cache=${cacheVersion} sha=${shortSha} builtAt=${builtAt}`);
