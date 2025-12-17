import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
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
  // Strategy 1: Use process.cwd() (Vercel's working directory is project root)
  let distPath = path.resolve(process.cwd(), "dist", "public");
  
  // Strategy 2: Try relative to import.meta.dirname (for local/bundled scenarios)
  if (!fs.existsSync(distPath)) {
    distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
  }
  
  // Strategy 3: Try just dist/public from cwd (fallback)
  if (!fs.existsSync(distPath)) {
    distPath = path.join(process.cwd(), "dist", "public");
  }

  if (!fs.existsSync(distPath)) {
    // Log all attempted paths for debugging
    const attemptedPaths = [
      path.resolve(process.cwd(), "dist", "public"),
      path.resolve(import.meta.dirname, "..", "dist", "public"),
      path.join(process.cwd(), "dist", "public"),
    ];
    throw new Error(
      `Could not find the build directory. Attempted paths: ${attemptedPaths.join(", ")}. ` +
      `Current working directory: ${process.cwd()}, import.meta.dirname: ${import.meta.dirname}. ` +
      `Make sure to build the client first with 'npm run build'.`
    );
  }

  log(`Serving static files from: ${distPath}`);
  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
