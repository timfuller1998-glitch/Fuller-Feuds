import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import routes from "./routes/index.js";
import { serveStatic, log } from "./vite.js";
import { startScheduledJobs } from "./scheduled-jobs.js";
import { BadgeRepository } from "./repositories/badgeRepository.js";
import { setupAuth } from "./auth.js";
import { attachUserRole } from "./middleware/permissions.js";
import { getCacheStats } from "./services/cacheService.js";

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

  log(`Error: ${message}`, "error");
  res.status(status).json({ message });
  // Don't re-throw in production - it crashes the serverless function
  if (process.env.NODE_ENV === 'development') {
    throw err;
  }
});

// importantly only setup vite in development and after
// setting up all the other routes so the catch-all route
// doesn't interfere with the other routes
if (app.get("env") === "development") {
  // Dynamically import setupVite only in development to avoid bundling Vite/Rollup in production
  const { setupVite } = await import("./vite.js");
  await setupVite(app, server);
} else {
  serveStatic(app);
}

// In Vercel serverless, @vercel/node handles the server
// Only start listening in non-serverless environments
if (process.env.VERCEL !== '1') {
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
} else {
  // In Vercel, initialize badges and start jobs asynchronously
  (async () => {
    try {
      await badgeRepository.initializeBadges();
      log("Badges initialized successfully");
    } catch (error: any) {
      log("Error initializing badges:", error);
    }
  })();
  
  // Don't start scheduled jobs in serverless - they won't work properly
  // Vercel has its own cron job system if needed
  log("Running in Vercel serverless environment");
}

// Export the app for Vercel
export default app;
