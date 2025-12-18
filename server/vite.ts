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
  
  // Priority order based on Vercel's file structure
  // 1. process.cwd()/dist/public - Most common in Vercel (files included at root)
  // 2. Relative to import.meta.dirname - Fallback for local/bundled scenarios
  const possiblePaths = [
    path.resolve(process.cwd(), "dist", "public"), // Primary: Vercel includes files at project root
    path.resolve(import.meta.dirname, "..", "dist", "public"), // Fallback 1: Relative to server/
    path.resolve(import.meta.dirname, "..", "..", "dist", "public"), // Fallback 2: If server is nested
  ];
  
  // Log attempted paths for debugging
  log(`Attempting to find dist/public. cwd: ${process.cwd()}, dirname: ${import.meta.dirname}`);
  
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      distPath = possiblePath;
      log(`✓ Found dist/public at: ${distPath}`);
      
      // Verify index.html exists
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        log(`✓ index.html found at: ${indexPath}`);
      } else {
        log(`⚠ WARNING: index.html not found at: ${indexPath}`);
      }
      break;
    } else {
      log(`✗ Path does not exist: ${possiblePath}`);
    }
  }
  
  if (!distPath) {
    const errorMsg = `Could not find dist/public directory. Tried: ${possiblePaths.join(", ")}. ` +
      `Current working directory: ${process.cwd()}, import.meta.dirname: ${import.meta.dirname}.`;
    log(`ERROR: ${errorMsg}`);
    
    // Serve error page instead of crashing
    app.get("*", (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      res.status(500).send(`
        <html>
          <head><title>Build Error</title></head>
          <body>
            <h1>Static files not found</h1>
            <p>${errorMsg}</p>
            <p>Check Vercel build logs to ensure 'npm run build' completed successfully.</p>
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
