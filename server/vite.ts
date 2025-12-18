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
  // SPA routing is handled by Vercel's routes configuration (vercel.json)
  // This function is only used for local development or as a fallback
  
  // Try to find index.html for local development fallback
  let indexPath: string | null = null;
  
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
    log(`INFO: index.html not found in serverless function. In Vercel, static files and SPA routing are handled by vercel.json routes.`);
    // In Vercel, this won't be called because routes are handled by vercel.json
    // But we'll set up a fallback for local development
  }

  // Fallback route handler for local development
  // In Vercel, this should not be reached due to vercel.json routes
  app.get("*", (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    
    // Skip static file requests - they should be handled by express.static or Vercel
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
    if (hasExtension) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Serve index.html for SPA routes (fallback for local dev)
    if (indexPath && fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'index.html not found. Make sure to run npm run build first.' });
    }
  });
}
