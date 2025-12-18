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
  
  // Always create the import file (even if index.html doesn't exist yet)
  // This ensures the import in server/index.ts always works
  const importFile = path.resolve(__dirname, '..', 'server', 'static-files.ts');
  let importContent;
  
  if (fs.existsSync(indexPath)) {
    console.log(`[Copy Static] ✓✓✓ index.html confirmed at: ${indexPath}`);
    
    // Create import file that reads the actual file
    importContent = `// Auto-generated file to force Vercel to include static files
import fs from 'fs';
import path from 'path';

const staticDir = path.resolve(import.meta.dirname, 'static');
const indexPath = path.join(staticDir, 'index.html');

// Read at module load to force inclusion
export const staticIndexHtml = fs.existsSync(indexPath) 
  ? fs.readFileSync(indexPath, 'utf-8')
  : null;

export const staticDirPath = staticDir;
`;
  } else {
    console.warn(`[Copy Static] ⚠ WARNING: index.html not found at: ${indexPath}`);
    // Create empty import file so import doesn't fail
    importContent = `// Auto-generated file (static files not found during build)
export const staticIndexHtml: string | null = null;
export const staticDirPath: string = '';
`;
  }
  
  fs.writeFileSync(importFile, importContent);
  console.log(`[Copy Static] ✓ Created import file: ${importFile}`);
  
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
