#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, '..', 'dist', 'public');
// Copy to server/static (for runtime access)
const targetDir = path.resolve(__dirname, '..', 'server', 'static');

console.log(`[Copy Static] Source: ${sourceDir}`);
console.log(`[Copy Static] Target: ${targetDir}`);

// Check if source exists
if (!fs.existsSync(sourceDir)) {
  console.error(`[Copy Static] ✗ Source directory does not exist: ${sourceDir}`);
  process.exit(1);
}

// Create target directory
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`[Copy Static] ✓ Created target directory: ${targetDir}`);
}

// Copy files recursively
function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  // Clear target directory first
  if (fs.existsSync(targetDir)) {
    const existingFiles = fs.readdirSync(targetDir);
    for (const file of existingFiles) {
      const filePath = path.join(targetDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }
  
  copyRecursive(sourceDir, targetDir);
  
  const copiedFiles = fs.readdirSync(targetDir);
  console.log(`[Copy Static] ✓ Successfully copied ${copiedFiles.length} items to ${targetDir}`);
  console.log(`[Copy Static] Sample files: ${copiedFiles.slice(0, 10).join(', ')}`);
  
  // Verify index.html exists
  const indexPath = path.join(targetDir, 'index.html');
  // #region agent log
  const logData = {location:'copy-static.js:67',message:'After copy - verifying files',data:{targetDir,indexPath,sourceDir,fileCount:copiedFiles.length,hasIndexHtml:fs.existsSync(indexPath),files:copiedFiles.slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
  // #endregion
  if (fs.existsSync(indexPath)) {
    console.log(`[Copy Static] ✓✓✓ index.html confirmed at: ${indexPath}`);
  } else {
    console.warn(`[Copy Static] ⚠ WARNING: index.html not found at: ${indexPath}`);
  }
  
  // Note: static-files.ts is now committed to the repo
  // It will automatically read from server/static when the module loads
  
  // Also verify the directory exists and list its contents for debugging
  if (fs.existsSync(targetDir)) {
    const verifyFiles = fs.readdirSync(targetDir);
    console.log(`[Copy Static] Verification: ${targetDir} contains ${verifyFiles.length} items`);
    console.log(`[Copy Static] Verification files: ${verifyFiles.slice(0, 20).join(', ')}`);
  } else {
    console.error(`[Copy Static] ✗ CRITICAL: Target directory does not exist after copy: ${targetDir}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`[Copy Static] ✗ Copy failed:`, error);
  console.error(`[Copy Static] Error stack:`, error.stack);
  process.exit(1);
}
