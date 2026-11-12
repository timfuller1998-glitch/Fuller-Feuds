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
// This ensures the directories are included during build
try {
  // Try server/static first (created by copy-static.js during build)
  const staticPath = path.resolve(import.meta.dirname, "static");
  const indexPath = path.join(staticPath, "index.html");
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.ts:71',message:'Module load - checking server/static',data:{staticPath,indexPath,dirname:import.meta.dirname,exists:fs.existsSync(staticPath),indexExists:fs.existsSync(indexPath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  if (fs.existsSync(indexPath)) {
    // Actually read the file to ensure it's included in build
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
    // Actually read the file to ensure it's included in build
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
  const candidates = [
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(import.meta.dirname, "..", "dist", "public"),
  ];
  const distPath = candidates.find((dir) => fs.existsSync(path.join(dir, "index.html"))) ?? null;

  if (!distPath) {
    const tried = candidates.join(", ");
    log(`[Static Files] ERROR: no dist/public/index.html (tried ${tried})`);
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) {
        return res.status(404).json({ error: "API route not found" });
      }
      res.status(500).send("Static files not found. The production build did not produce dist/public/index.html.");
    });
    return;
  }

  log(`[Static Files] Serving a single build from ${distPath}`);

  const noStore = "no-cache, no-store, must-revalidate";
  const applyContentType = (res: any, filePath: string) => {
    if (filePath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    else if (filePath.endsWith(".css")) res.setHeader("Content-Type", "text/css; charset=utf-8");
    else if (filePath.endsWith(".html")) res.setHeader("Content-Type", "text/html; charset=utf-8");
    else if (filePath.endsWith(".json")) res.setHeader("Content-Type", "application/json; charset=utf-8");
    else if (filePath.endsWith(".svg")) res.setHeader("Content-Type", "image/svg+xml");
    else if (filePath.endsWith(".png")) res.setHeader("Content-Type", "image/png");
    else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) res.setHeader("Content-Type", "image/jpeg");
    else if (filePath.endsWith(".woff") || filePath.endsWith(".woff2")) res.setHeader("Content-Type", "font/woff2");
  };

  app.use(express.static(distPath, {
    index: false,
    etag: true,
    maxAge: 0,
    setHeaders: (res, filePath) => {
      applyContentType(res, filePath);
      const base = path.basename(filePath);
      const normalized = filePath.replace(/\\/g, "/");
      const isHashedAsset = normalized.includes("/assets/");
      if (
        base === "index.html" ||
        base === "service-worker.js" ||
        base === "manifest.json" ||
        base === "version.json"
      ) {
        res.setHeader("Cache-Control", noStore);
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      } else if (isHashedAsset) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") {
      return next();
    }
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
    if (hasExtension) {
      return res.status(404).json({ error: "File not found", path: req.path });
    }
    const indexPath = path.resolve(distPath, "index.html");
    res.setHeader("Cache-Control", noStore);
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(indexPath);
  });
}
