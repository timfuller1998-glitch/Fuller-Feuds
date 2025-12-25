import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { log as logUtil } from "./utils/logger.js";

export function log(message: string, source = "express") {
  logUtil(message, source);
}

export async function setupVite(app: Express, server: Server) {
  // Dynamically import Vite only in development to avoid bundling it in production
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteConfig = await import("../vite.config.js");
  const { nanoid } = await import("nanoid");
  
  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig.default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// Force bundler to include static files by attempting to read them at module load time
// This ensures the directories are included even if includeFiles doesn't work
// Vercel will include files that are read via fs operations at module load time
try {
  // Try server/static first (created by copy-static.js during build)
  const staticPath = path.resolve(import.meta.dirname, "static");
  const indexPath = path.join(staticPath, "index.html");
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.ts:71',message:'Module load - checking server/static',data:{staticPath,indexPath,dirname:import.meta.dirname,exists:fs.existsSync(staticPath),indexExists:fs.existsSync(indexPath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  if (fs.existsSync(indexPath)) {
    // Actually read the file to force Vercel to include it
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.ts:75',message:'Reading server/static/index.html',data:{indexPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    fs.readFileSync(indexPath, "utf-8");
  }
} catch (error: any) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.ts:79',message:'Error checking server/static',data:{error:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  // Ignore - file might not exist during build, that's OK
}

try {
  // Also try dist/public (where vite builds to)
  const distPublicPath = path.resolve(process.cwd(), "dist", "public");
  const distIndexPath = path.join(distPublicPath, "index.html");
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.ts:86',message:'Module load - checking dist/public',data:{distPublicPath,distIndexPath,cwd:process.cwd(),exists:fs.existsSync(distPublicPath),indexExists:fs.existsSync(distIndexPath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  if (fs.existsSync(distIndexPath)) {
    // Actually read the file to force Vercel to include it
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.ts:90',message:'Reading dist/public/index.html',data:{distIndexPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    fs.readFileSync(distIndexPath, "utf-8");
  }
} catch (error: any) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.ts:94',message:'Error checking dist/public',data:{error:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  // Ignore - file might not exist during build, that's OK
}

export function serveStatic(app: Express) {
  // Find the dist/public directory
  // In Vercel, files included via includeFiles are available relative to process.cwd()
  // process.cwd() in Vercel serverless functions is typically /var/task (project root)
  let distPath: string | null = null;
  
  const cwd = process.cwd();
  const dirname = import.meta.dirname;
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.ts:100',message:'serveStatic called - runtime check',data:{cwd,dirname,nodeEnv:process.env.NODE_ENV,vercel:process.env.VERCEL},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  // Priority order based on Vercel's file structure
  // Try multiple strategies to find dist/public
  // NOTE: Prefer dist/public over server/static since it has the assets directory
  const possiblePaths = [
    // Strategy 1: Direct from cwd (where includeFiles places files) - PREFERRED (has assets)
    path.resolve(cwd, "dist", "public"),
    // Strategy 2: Copied to server/static during build (fallback if dist/public not available)
    path.resolve(dirname, "static"),
    // Strategy 3: Relative to server directory
    path.resolve(dirname, "..", "dist", "public"),
    // Strategy 4: Vercel's static output (if using @vercel/static builder)
    path.resolve(cwd, ".vercel", "output", "static"),
    // Strategy 5: If server is nested deeper
    path.resolve(dirname, "..", "..", "dist", "public"),
    // Strategy 6: Check if dist exists at root
    path.resolve(cwd, "dist"),
    // Strategy 7: Check if files are at function root (unlikely but possible)
    path.resolve(cwd, "public"),
  ];
  
  // Log environment info for debugging
  log(`[Static Files] Searching for dist/public`);
  log(`[Static Files] cwd: ${cwd}`);
  log(`[Static Files] import.meta.dirname: ${dirname}`);
  log(`[Static Files] __dirname equivalent: ${path.dirname(new URL(import.meta.url).pathname)}`);
  
  // Try to list what's actually in cwd for debugging
  try {
    const cwdContents = fs.existsSync(cwd) ? fs.readdirSync(cwd) : [];
    log(`[Static Files] Contents of cwd (${cwd}): ${cwdContents.slice(0, 20).join(", ")}`);
    
    // Check if dist exists
    const distPathCheck = path.resolve(cwd, "dist");
    if (fs.existsSync(distPathCheck)) {
      const distContents = fs.readdirSync(distPathCheck);
      log(`[Static Files] Contents of dist/: ${distContents.join(", ")}`);
    } else {
      log(`[Static Files] dist/ does not exist at: ${distPathCheck}`);
    }
    
    // Check what's in the server directory (to see if static exists)
    const serverDirPath = path.resolve(dirname);
    if (fs.existsSync(serverDirPath)) {
      try {
        const serverContents = fs.readdirSync(serverDirPath);
        log(`[Static Files] Contents of server/ (${serverDirPath}): ${serverContents.slice(0, 30).join(", ")}`);
        
        // Specifically check if server/static exists
        const serverStaticPath = path.resolve(serverDirPath, "static");
        if (fs.existsSync(serverStaticPath)) {
          const staticContents = fs.readdirSync(serverStaticPath);
          log(`[Static Files] ✓ server/static EXISTS with ${staticContents.length} files: ${staticContents.slice(0, 10).join(", ")}`);
        } else {
          log(`[Static Files] ✗ server/static does NOT exist at: ${serverStaticPath}`);
        }
      } catch (e) {
        log(`[Static Files] Could not read server directory: ${e}`);
      }
    }
  } catch (e) {
    log(`[Static Files] Could not read cwd contents: ${e}`);
  }
  
  // Try each possible path
  for (const possiblePath of possiblePaths) {
    log(`[Static Files] Checking: ${possiblePath}`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.ts:151',message:'Checking path',data:{possiblePath,exists:fs.existsSync(possiblePath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (fs.existsSync(possiblePath)) {
      // Verify it's a directory and has files
      try {
        const stats = fs.statSync(possiblePath);
        if (stats.isDirectory()) {
          const files = fs.readdirSync(possiblePath);
          log(`[Static Files] ✓ Found directory with ${files.length} files: ${possiblePath}`);
          log(`[Static Files] Sample files: ${files.slice(0, 10).join(", ")}`);
          
          // Verify index.html exists
          const indexPath = path.join(possiblePath, "index.html");
          const assetsPath = path.join(possiblePath, "assets");
          const hasIndexHtml = fs.existsSync(indexPath);
          const hasAssets = fs.existsSync(assetsPath) && fs.statSync(assetsPath).isDirectory();
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.ts:163',message:'Directory found, checking index.html and assets',data:{possiblePath,indexPath,assetsPath,fileCount:files.length,hasIndexHtml,hasAssets,files:files.slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          
          // Prefer paths that have both index.html AND assets directory
          if (hasIndexHtml) {
            // Always prefer a path with assets over one without
            const currentHasAssets = distPath ? fs.existsSync(path.join(distPath, "assets")) && fs.statSync(path.join(distPath, "assets")).isDirectory() : false;
            
            if (hasAssets || !distPath || !currentHasAssets) {
              distPath = possiblePath;
              log(`[Static Files] ✓✓✓ SUCCESS: Using ${distPath} (index.html confirmed${hasAssets ? ', assets confirmed' : ''})`);
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.ts:168',message:'SUCCESS - found static files',data:{distPath,indexPath,hasAssets,currentHasAssets},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
              // If this path has assets, we're done. Otherwise keep looking for a better one.
              if (hasAssets) {
                break;
              }
            } else {
              log(`[Static Files] ⚠ Found index.html but no assets, keeping current selection with assets`);
            }
          } else {
            log(`[Static Files] ⚠ Directory found but index.html missing at: ${indexPath}`);
            // Still use it if it has files (might be a different structure) and we don't have a better option
            if (files.length > 0 && !distPath) {
              distPath = possiblePath;
              log(`[Static Files] Using ${distPath} despite missing index.html`);
            }
          }
        } else {
          log(`[Static Files] ✗ Path exists but is not a directory: ${possiblePath}`);
        }
      } catch (e: any) {
        log(`[Static Files] ✗ Error checking path: ${possiblePath}, error: ${e}`);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.ts:182',message:'Error checking path',data:{possiblePath,error:e?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      }
    } else {
      log(`[Static Files] ✗ Path does not exist: ${possiblePath}`);
    }
  }
  
  if (!distPath) {
    // Comprehensive error message with debugging info
    let debugInfo = `Attempted paths:\n${possiblePaths.map(p => `  - ${p}`).join("\n")}\n\n`;
    debugInfo += `Environment:\n`;
    debugInfo += `  - cwd: ${cwd}\n`;
    debugInfo += `  - dirname: ${dirname}\n`;
    debugInfo += `  - NODE_ENV: ${process.env.NODE_ENV}\n`;
    debugInfo += `  - VERCEL: ${process.env.VERCEL}\n`;
    
    // Try to list what's in cwd
    try {
      if (fs.existsSync(cwd)) {
        const cwdContents = fs.readdirSync(cwd);
        debugInfo += `\nContents of cwd:\n  ${cwdContents.slice(0, 30).join(", ")}\n`;
      }
    } catch (e) {
      debugInfo += `\nCould not read cwd: ${e}\n`;
    }
    
    const errorMsg = `Could not find dist/public directory.\n\n${debugInfo}\n\n` +
      `Possible issues:\n` +
      `1. Build didn't complete successfully (check Vercel build logs)\n` +
      `2. includeFiles pattern doesn't match actual file structure\n` +
      `3. Files are in a different location than expected\n\n` +
      `Check /api/debug/static for more information.`;
    
    log(`[Static Files] ERROR: ${errorMsg}`);
    
    // Serve error page instead of crashing
    app.get("*", (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      res.status(500).send(`
        <html>
          <head>
            <title>Build Error - Static Files Not Found</title>
            <style>
              body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #fff; }
              pre { background: #2a2a2a; padding: 15px; border-radius: 5px; overflow-x: auto; }
              h1 { color: #ff6b6b; }
            </style>
          </head>
          <body>
            <h1>Static Files Not Found</h1>
            <pre>${errorMsg.replace(/\n/g, '<br>')}</pre>
            <p><strong>Action Required:</strong></p>
            <ol>
              <li>Check Vercel build logs to ensure 'npm run build' completed successfully</li>
              <li>Verify that dist/public directory exists after build</li>
              <li>Check /api/debug/static endpoint for detailed debugging information</li>
              <li>Verify includeFiles pattern in vercel.json matches your build output</li>
            </ol>
          </body>
        </html>
      `);
    });
    return;
  }
  
  // Serve assets directory at root level FIRST (before express.static)
  // Vite outputs assets to /assets/ but HTML references them at root
  // This handles requests like /index-xxx.js that should serve from /assets/index-xxx.js
  const assetsPath = path.join(distPath, 'assets');
  if (fs.existsSync(assetsPath)) {
    app.use((req, res, next) => {
      // Only handle root-level asset file requests (not /assets/... or /api/... requests)
      const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
      const isRootLevelAsset = hasExtension && !req.path.startsWith('/assets/') && !req.path.startsWith('/api/');
      
      if (isRootLevelAsset) {
        const fileName = path.basename(req.path);
        const assetFilePath = path.resolve(assetsPath, fileName);
        
        if (fs.existsSync(assetFilePath)) {
          if (process.env.VERCEL === '1') {
            console.log(`[ASSETS] Serving ${req.path} from ${assetFilePath}`);
          }
          // Set proper content type
          const ext = path.extname(fileName).toLowerCase();
          if (ext === '.js') {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          } else if (ext === '.css') {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
          } else if (ext === '.json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
            res.setHeader('Content-Type', ext === '.png' ? 'image/png' : 'image/jpeg');
          }
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return res.sendFile(assetFilePath);
        }
      }
      next();
    });
    log(`[Static Files] Serving assets directory files at root level: ${assetsPath}`);
  }
  
  // Serve static files with proper headers
  // This middleware must come BEFORE the catch-all route
  app.use((req, res, next) => {
    // Log static file requests for debugging
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
    if (hasExtension && !req.path.startsWith('/api')) {
      const requestedPath = path.join(distPath, req.path);
      const exists = fs.existsSync(requestedPath);
      if (process.env.VERCEL === '1') {
        console.log(`[STATIC REQUEST] ${req.path} -> ${requestedPath} (exists: ${exists}, distPath: ${distPath})`);
        // List what's actually in distPath for debugging
        try {
          if (fs.existsSync(distPath)) {
            const contents = fs.readdirSync(distPath);
            console.log(`[STATIC REQUEST] Contents of distPath: ${contents.slice(0, 20).join(', ')}`);
            const assetsDir = path.join(distPath, 'assets');
            if (fs.existsSync(assetsDir)) {
              const assets = fs.readdirSync(assetsDir);
              console.log(`[STATIC REQUEST] Assets directory contents: ${assets.slice(0, 10).join(', ')}`);
            }
          }
        } catch (e) {
          console.log(`[STATIC REQUEST] Could not list distPath contents: ${e}`);
        }
      }
      if (!exists) {
        // Try alternative paths (Vite puts assets in assets/ subdirectory)
        const fileName = path.basename(req.path);
        const altPaths = [
          path.join(distPath, 'assets', fileName), // Most common: assets subdirectory
          path.join(distPath, req.path.replace(/^\//, '')), // Without leading slash
          path.join(distPath, 'assets', req.path.replace(/^\//, '')), // assets without leading slash
        ];
        for (const altPath of altPaths) {
          try {
            if (fs.existsSync(altPath)) {
              console.log(`[STATIC REQUEST] Found at alternative path: ${altPath}`);
              // Set proper content type based on file extension
              const ext = path.extname(fileName).toLowerCase();
              if (ext === '.js') {
                res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
              } else if (ext === '.css') {
                res.setHeader('Content-Type', 'text/css; charset=utf-8');
              } else if (ext === '.json') {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
              }
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
              // Use absolute path for sendFile
              const absolutePath = path.resolve(altPath);
              console.log(`[STATIC REQUEST] Serving file from: ${absolutePath}`);
              return res.sendFile(absolutePath);
            }
          } catch (e: any) {
            console.log(`[STATIC REQUEST] Error checking/serving alternative path ${altPath}: ${e?.message || e}`);
          }
        }
        console.log(`[STATIC REQUEST] File not found at any path. Tried: ${requestedPath} and ${altPaths.join(', ')}`);
        // Don't call next() here - let express.static try, then our later middleware will handle it
      } else {
        // File exists at requested path, let express.static handle it
        if (process.env.VERCEL === '1') {
          console.log(`[STATIC REQUEST] File exists at requested path: ${requestedPath}`);
        }
      }
    }
    next();
  });
  
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      // Set correct Content-Type headers for different file types
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
      } else if (filePath.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      } else if (filePath.endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
      } else if (filePath.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (filePath.endsWith('.woff') || filePath.endsWith('.woff2')) {
        res.setHeader('Content-Type', 'font/woff2');
      }
    },
    index: false, // Don't serve index.html automatically for directories
    maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0' // Cache static files in production
  }));
  
  
  // SPA fallback: serve index.html for routes without file extensions
  app.get("*", (req, res, next) => {
    // Log for debugging domain issues
    if (process.env.VERCEL === '1') {
      console.log(`[STATIC] SPA fallback - Path: ${req.path}, Host: ${req.hostname}, HasExtension: ${/\.[a-zA-Z0-9]+$/.test(req.path)}`);
    }
    
    // Skip API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    
    // Skip static file requests (they should have been handled by express.static)
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
    if (hasExtension) {
      console.log(`[STATIC] 404 - Static file not found: ${req.path} (Host: ${req.hostname})`);
      return res.status(404).json({ error: 'File not found', path: req.path, hostname: req.hostname });
    }
    
    // Serve index.html for SPA routes
    const indexPath = path.resolve(distPath!, "index.html");
    if (fs.existsSync(indexPath)) {
      console.log(`[STATIC] Serving index.html for SPA route: ${req.path} (Host: ${req.hostname})`);
      res.sendFile(indexPath);
    } else {
      console.error(`[STATIC] ERROR - index.html not found at: ${indexPath} (Host: ${req.hostname}, distPath: ${distPath})`);
      res.status(404).json({ error: 'index.html not found', indexPath, distPath, hostname: req.hostname });
    }
  });
}
