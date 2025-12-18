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

export function serveStatic(app: Express) {
  // Find the dist/public directory
  // In Vercel, files included via includeFiles are available relative to process.cwd()
  // process.cwd() in Vercel serverless functions is typically /var/task (project root)
  let distPath: string | null = null;
  
  const cwd = process.cwd();
  const dirname = import.meta.dirname;
  
  // Priority order based on Vercel's file structure
  // Try multiple strategies to find dist/public
  const possiblePaths = [
    // Strategy 1: Direct from cwd (most common in Vercel)
    path.resolve(cwd, "dist", "public"),
    // Strategy 2: Relative to server directory
    path.resolve(dirname, "..", "dist", "public"),
    // Strategy 3: If server is nested deeper
    path.resolve(dirname, "..", "..", "dist", "public"),
    // Strategy 4: Check if dist exists at root
    path.resolve(cwd, "dist"),
    // Strategy 5: Check if files are at function root (unlikely but possible)
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
  } catch (e) {
    log(`[Static Files] Could not read cwd contents: ${e}`);
  }
  
  // Try each possible path
  for (const possiblePath of possiblePaths) {
    log(`[Static Files] Checking: ${possiblePath}`);
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
          if (fs.existsSync(indexPath)) {
            distPath = possiblePath;
            log(`[Static Files] ✓✓✓ SUCCESS: Using ${distPath} (index.html confirmed)`);
            break;
          } else {
            log(`[Static Files] ⚠ Directory found but index.html missing at: ${indexPath}`);
            // Still use it if it has files (might be a different structure)
            if (files.length > 0) {
              distPath = possiblePath;
              log(`[Static Files] Using ${distPath} despite missing index.html`);
              break;
            }
          }
        } else {
          log(`[Static Files] ✗ Path exists but is not a directory: ${possiblePath}`);
        }
      } catch (e) {
        log(`[Static Files] ✗ Error checking path: ${possiblePath}, error: ${e}`);
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
  
  // Serve static files with proper headers
  // This middleware must come BEFORE the catch-all route
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
    // Skip API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    
    // Skip static file requests (they should have been handled by express.static)
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
    if (hasExtension) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Serve index.html for SPA routes
    const indexPath = path.resolve(distPath!, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'index.html not found' });
    }
  });
}
