// This file forces Vercel to include server/static directory in the bundle
// by attempting to import/read files from it at module load time
import fs from 'fs';
import path from 'path';

const staticDir = path.resolve(import.meta.dirname, 'static');
const indexPath = path.join(staticDir, 'index.html');

// Try to read index.html to force Vercel to include the static directory
// This must happen at module load time, not runtime
try {
  if (fs.existsSync(indexPath)) {
    // Read the file to force inclusion - Vercel will trace this dependency
    const content = fs.readFileSync(indexPath, 'utf-8');
    // Store it in a way that won't cause issues if the file doesn't exist
    (globalThis as any).__staticIndexHtml = content;
  }
} catch (error) {
  // Ignore - file might not exist during build
  // This is OK, the serveStatic function will handle runtime file serving
}

export function getStaticIndexHtml(): string | null {
  return (globalThis as any).__staticIndexHtml || null;
}
