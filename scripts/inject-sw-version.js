#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json to get version
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const packageVersion = packageJson.version || '1.0.0';

// Generate cache version with timestamp
const buildTimestamp = Date.now();
const cacheVersion = `fuller-feuds-${packageVersion}-${buildTimestamp}`;
const runtimeCacheVersion = `fuller-feuds-runtime-${packageVersion}-${buildTimestamp}`;

// Paths
const sourcePath = path.resolve(__dirname, '..', 'public', 'service-worker.js');
const targetPath = path.resolve(__dirname, '..', 'dist', 'public', 'service-worker.js');

console.log(`[Inject SW Version] Source: ${sourcePath}`);
console.log(`[Inject SW Version] Target: ${targetPath}`);
console.log(`[Inject SW Version] Cache version: ${cacheVersion}`);

// Check if source exists
if (!fs.existsSync(sourcePath)) {
  console.error(`[Inject SW Version] ✗ Source file does not exist: ${sourcePath}`);
  process.exit(1);
}

// Read source service worker
let swContent = fs.readFileSync(sourcePath, 'utf-8');

// Replace placeholders with actual cache versions
swContent = swContent.replace(
  /const CACHE_NAME = '{{CACHE_VERSION}}';/g,
  `const CACHE_NAME = '${cacheVersion}';`
);

swContent = swContent.replace(
  /const RUNTIME_CACHE = '{{RUNTIME_CACHE_VERSION}}';/g,
  `const RUNTIME_CACHE = '${runtimeCacheVersion}';`
);

// Ensure target directory exists
const targetDir = path.dirname(targetPath);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`[Inject SW Version] ✓ Created target directory: ${targetDir}`);
}

// Write modified service worker
try {
  fs.writeFileSync(targetPath, swContent, 'utf-8');
  console.log(`[Inject SW Version] ✓ Successfully injected version and wrote to: ${targetPath}`);
} catch (error) {
  console.error(`[Inject SW Version] ✗ Failed to write file:`, error);
  process.exit(1);
}

