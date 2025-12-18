// Auto-generated file to force Vercel to include static files
// This file is updated by scripts/copy-static.js during build
import fs from 'fs';
import path from 'path';

const staticDir = path.resolve(import.meta.dirname, 'static');
const indexPath = path.join(staticDir, 'index.html');

// Read at module load to force inclusion
// If the file doesn't exist during build, this will be null
export const staticIndexHtml: string | null = (() => {
  try {
    if (fs.existsSync(indexPath)) {
      return fs.readFileSync(indexPath, 'utf-8');
    }
  } catch {
    // Ignore errors
  }
  return null;
})();

export const staticDirPath = staticDir;
