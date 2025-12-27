// Auto-generated file to ensure static files are included in build
// This file is updated by scripts/copy-static.js during build
import fs from 'fs';
import path from 'path';

const staticDir = path.resolve(import.meta.dirname, 'static');
const indexPath = path.join(staticDir, 'index.html');

// #region agent log
const logData1 = {location:'static-files.ts:12',message:'Module load - checking static dir',data:{staticDir,indexPath,dirname:import.meta.dirname,cwd:process.cwd(),exists:fs.existsSync(staticDir),indexExists:fs.existsSync(indexPath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
console.log('[DEBUG]', JSON.stringify(logData1));
fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData1)}).catch(()=>{});
// #endregion

// Read at module load to force inclusion
// If the file doesn't exist during build, this will be null
export const staticIndexHtml: string | null = (() => {
  try {
    // #region agent log
    const logData2 = {location:'static-files.ts:18',message:'Before fs.existsSync check',data:{indexPath,dirname:import.meta.dirname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
    console.log('[DEBUG]', JSON.stringify(logData2));
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData2)}).catch(()=>{});
    // #endregion
    if (fs.existsSync(indexPath)) {
      // #region agent log
      const logData3 = {location:'static-files.ts:22',message:'File exists, reading',data:{indexPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
      console.log('[DEBUG]', JSON.stringify(logData3));
      fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData3)}).catch(()=>{});
      // #endregion
      const content = fs.readFileSync(indexPath, 'utf-8');
      // #region agent log
      const logData4 = {location:'static-files.ts:26',message:'File read successful',data:{contentLength:content.length,firstChars:content.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
      console.log('[DEBUG]', JSON.stringify(logData4));
      fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData4)}).catch(()=>{});
      // #endregion
      return content;
    } else {
      // #region agent log
      const logData5 = {location:'static-files.ts:30',message:'File does not exist',data:{indexPath,staticDirExists:fs.existsSync(staticDir)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
      console.log('[DEBUG]', JSON.stringify(logData5));
      fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData5)}).catch(()=>{});
      // #endregion
    }
  } catch (error: any) {
    // #region agent log
    const logData6 = {location:'static-files.ts:34',message:'Error reading file',data:{error:error.message,indexPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
    console.log('[DEBUG]', JSON.stringify(logData6));
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData6)}).catch(()=>{});
    // #endregion
  }
  return null;
})();

export const staticDirPath = staticDir;
