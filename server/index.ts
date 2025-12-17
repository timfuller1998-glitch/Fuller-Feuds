import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import routes from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startScheduledJobs } from "./scheduled-jobs";
import { BadgeRepository } from "./repositories/badgeRepository";
import { setupAuth } from "./auth";
import { attachUserRole } from "./middleware/permissions";
import { getCacheStats } from "./services/cacheService";

const badgeRepository = new BadgeRepository();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from public folder (for PWA files: service-worker.js, manifest.json, icons)
const publicPath = path.resolve(import.meta.dirname, "..", "public");
app.use(express.static(publicPath));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Setup authentication middleware
setupAuth(app);

// Attach user role to all requests
app.use(attachUserRole);

// Mount API routes
app.use('/api', routes);

// Diagnostic route to check static file setup (remove in production if needed)
if (process.env.NODE_ENV === 'production') {
  app.get('/api/debug/static', (req, res) => {
    const distPath = path.resolve(process.cwd(), "dist", "public");
    const altPath = path.resolve(import.meta.dirname, "..", "dist", "public");
    
    try {
      const files = fs.existsSync(distPath) ? fs.readdirSync(distPath) : [];
      const altFiles = fs.existsSync(altPath) ? fs.readdirSync(altPath) : [];
      
      res.json({
        cwd: process.cwd(),
        importMetaDirname: import.meta.dirname,
        distPath,
        distPathExists: fs.existsSync(distPath),
        distPathFiles: files.slice(0, 10),
        altPath,
        altPathExists: fs.existsSync(altPath),
        altPathFiles: altFiles.slice(0, 10),
        indexHtmlExists: fs.existsSync(path.join(distPath, "index.html")),
        env: process.env.NODE_ENV,
      });
    } catch (error: any) {
      res.json({ error: error.message, stack: error.stack });
    }
  });
}

// Create HTTP server
const server = createServer(app);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ message });
  throw err;
});

// importantly only setup vite in development and after
// setting up all the other routes so the catch-all route
// doesn't interfere with the other routes
if (app.get("env") === "development") {
  await setupVite(app, server);
} else {
  serveStatic(app);
}

// ALWAYS serve the app on the port specified in the environment variable PORT
// Other ports are firewalled. Default to 5000 if not specified.
// this serves both the API and the client.
// It is the only port that is not firewalled.
const port = parseInt(process.env.PORT || '5000', 10);
server.listen({
  port,
  host: process.env.NODE_ENV === 'production' ? "0.0.0.0" : "localhost",
  reusePort: process.env.NODE_ENV === 'production',
}, async () => {
  log(`serving on port ${port}`);

  // Initialize badges in the database
  try {
    await badgeRepository.initializeBadges();
    log("Badges initialized successfully");
  } catch (error: any) {
    log("Error initializing badges:", error);
  }

  startScheduledJobs();

  // Log cache stats periodically (every 5 minutes)
  setInterval(() => {
    const stats = getCacheStats();
    log(`[Cache Stats] Hits: ${stats.hits}, Misses: ${stats.misses}, Hit Rate: ${stats.hitRate.toFixed(2)}%, Memory Size: ${stats.memorySize}, Invalidations: ${stats.invalidations}`);
  }, 5 * 60 * 1000);
});
