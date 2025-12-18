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
  // In Vercel serverless, try multiple path resolution strategies
  // Strategy 1: Use process.cwd() (Vercel's working directory is /var/task)
  let distPath = path.resolve(process.cwd(), "dist", "public");
  
  // Strategy 2: Try relative to import.meta.dirname (for local/bundled scenarios)
  if (!fs.existsSync(distPath)) {
    distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
  }
  
  // Strategy 3: Try relative to import.meta.dirname going up to project root
  if (!fs.existsSync(distPath)) {
    distPath = path.resolve(import.meta.dirname, "..", "..", "dist", "public");
  }
  
  // Strategy 4: Try just dist/public from cwd (fallback)
  if (!fs.existsSync(distPath)) {
    distPath = path.join(process.cwd(), "dist", "public");
  }
  
  // Strategy 5: In Vercel, included files might be at the root level
  if (!fs.existsSync(distPath)) {
    distPath = path.resolve(process.cwd(), "public");
  }

  if (!fs.existsSync(distPath)) {
    // Log all attempted paths for debugging
    const attemptedPaths = [
      path.resolve(process.cwd(), "dist", "public"),
      path.resolve(import.meta.dirname, "..", "dist", "public"),
      path.join(process.cwd(), "dist", "public"),
    ];
    const errorMsg = `Could not find the build directory. Attempted paths: ${attemptedPaths.join(", ")}. ` +
      `Current working directory: ${process.cwd()}, import.meta.dirname: ${import.meta.dirname}. ` +
      `Make sure to build the client first with 'npm run build'.`;
    log(`ERROR: ${errorMsg}`);
    
    // Instead of throwing (which crashes the serverless function), serve an error page
    app.use("*", (_req, res) => {
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
    return; // Exit early, don't set up static serving
  }

  log(`Serving static files from: ${distPath}`);
  
  // List files in dist/public for debugging
  try {
    const files = fs.readdirSync(distPath);
    log(`Found ${files.length} files in dist/public. Sample: ${files.slice(0, 5).join(", ")}`);
  } catch (e) {
    log(`Warning: Could not list files in ${distPath}: ${e}`);
  }
  
  // Serve static files with proper headers
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      // Ensure JavaScript files are served with correct Content-Type
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
      }
    },
    index: false // Don't serve index.html automatically for directories
  }));

  // fall through to index.html only for routes that don't match static files
  // This must come after express.static so static files are served first
  // Use app.get instead of app.use to only match GET requests
  app.get("*", (req, res) => {
    // Skip API routes - they should be handled by the API router
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    
    // Check if this is a static file request (has extension)
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
    
    if (hasExtension) {
      // This should have been handled by express.static
      // If we reach here, the file doesn't exist - return 404
      log(`Static file not found: ${req.path}`);
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Only serve index.html for routes without file extensions (SPA routing)
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      log(`index.html not found at: ${indexPath}`);
      res.status(404).json({ error: 'index.html not found' });
    }
  });
}
