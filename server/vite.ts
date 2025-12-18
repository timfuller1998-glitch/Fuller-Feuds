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
  // In Vercel, static files are served by @vercel/static builder
  // We only need to serve index.html for SPA routing
  // Static assets (JS, CSS, images) are handled by Vercel automatically
  
  // Try to find index.html for SPA fallback
  // In Vercel, static files from dist/public are served directly
  // So we only need to handle the index.html fallback for client-side routing
  let indexPath: string | null = null;
  
  // Try multiple paths to find index.html
  const possiblePaths = [
    path.resolve(process.cwd(), "dist", "public", "index.html"),
    path.resolve(import.meta.dirname, "..", "dist", "public", "index.html"),
    path.resolve(import.meta.dirname, "..", "..", "dist", "public", "index.html"),
  ];
  
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      indexPath = possiblePath;
      log(`Found index.html at: ${indexPath}`);
      break;
    }
  }
  
  if (!indexPath) {
    log(`WARNING: Could not find index.html. Static files should be served by Vercel's @vercel/static builder.`);
    // Still set up the SPA route handler - Vercel will serve static files
  }

  // In Vercel, static files (JS, CSS, images) are served by @vercel/static
  // We only need to serve index.html for SPA client-side routing
  // Use app.get instead of app.use to only match GET requests
  app.get("*", (req, res) => {
    // Skip API routes - they should be handled by the API router
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    
    // Skip static file requests - they're handled by Vercel's static file serving
    // Static files have extensions and should be served by @vercel/static builder
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
    if (hasExtension) {
      // Let Vercel handle static files, or return 404 if not found
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Serve index.html for SPA routes (routes without file extensions)
    if (indexPath && fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      log(`index.html not found. Path: ${indexPath}`);
      res.status(404).json({ error: 'index.html not found' });
    }
  });
}
