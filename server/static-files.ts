// Auto-generated file to force Vercel to include static files
// This file is updated by scripts/copy-static.js during build
import fs from 'fs';
import path from 'path';

const staticDir = path.resolve(import.meta.dirname, 'static');
const indexPath = path.join(staticDir, 'index.html');

// #region agent log
fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'static-files.ts:12',message:'Module load - checking static dir',data:{staticDir,indexPath,dirname:import.meta.dirname,cwd:process.cwd(),exists:fs.existsSync(staticDir),indexExists:fs.existsSync(indexPath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
// #endregion

// Read at module load to force inclusion
// If the file doesn't exist during build, this will be null
export const staticIndexHtml: string | null = (() => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'static-files.ts:18',message:'Before fs.existsSync check',data:{indexPath,dirname:import.meta.dirname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (fs.existsSync(indexPath)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'static-files.ts:22',message:'File exists, reading',data:{indexPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      const content = fs.readFileSync(indexPath, 'utf-8');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'static-files.ts:26',message:'File read successful',data:{contentLength:content.length,firstChars:content.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return content;
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'static-files.ts:30',message:'File does not exist',data:{indexPath,staticDirExists:fs.existsSync(staticDir)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    }
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'static-files.ts:34',message:'Error reading file',data:{error:error.message,indexPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  }
  return null;
})();

export const staticDirPath = staticDir;
