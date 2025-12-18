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

// Diagnostic route to check static file setup
app.get('/api/debug/static', (req, res) => {
  const cwd = process.cwd();
  const dirname = import.meta.dirname;
  
  const pathsToCheck = [
    path.resolve(cwd, "dist", "public"),
    path.resolve(dirname, "..", "dist", "public"),
    path.resolve(dirname, "..", "..", "dist", "public"),
    path.resolve(cwd, "dist"),
    path.resolve(cwd, "public"),
  ];
  
  const results: Record<string, any> = {
    environment: {
      cwd,
      importMetaDirname: dirname,
      nodeEnv: process.env.NODE_ENV,
      vercel: process.env.VERCEL,
    },
    paths: {},
    cwdContents: [],
    recommendations: []
  };
  
  // Check each path
  for (const checkPath of pathsToCheck) {
    try {
      const exists = fs.existsSync(checkPath);
      const info: any = { exists };
      
      if (exists) {
        const stats = fs.statSync(checkPath);
        info.isDirectory = stats.isDirectory();
        info.isFile = stats.isFile();
        
        if (stats.isDirectory()) {
          try {
            const files = fs.readdirSync(checkPath);
            info.files = files.slice(0, 20);
            info.fileCount = files.length;
            info.hasIndexHtml = files.includes("index.html");
            
            if (files.includes("index.html")) {
              const indexPath = path.join(checkPath, "index.html");
              info.indexHtmlPath = indexPath;
              info.indexHtmlExists = fs.existsSync(indexPath);
            }
          } catch (e: any) {
            info.readError = e.message;
          }
        }
      }
      
      results.paths[checkPath] = info;
    } catch (error: any) {
      results.paths[checkPath] = { error: error.message };
    }
  }
  
  // List cwd contents
  try {
    if (fs.existsSync(cwd)) {
      results.cwdContents = fs.readdirSync(cwd).slice(0, 50);
    }
  } catch (e: any) {
    results.cwdReadError = e.message;
  }
  
  // Check if dist exists
  const distPath = path.resolve(cwd, "dist");
  if (fs.existsSync(distPath)) {
    try {
      results.distContents = fs.readdirSync(distPath).slice(0, 20);
    } catch (e: any) {
      results.distReadError = e.message;
    }
  }
  
  // Add recommendations
  const foundPath = Object.entries(results.paths).find(([_, info]: [string, any]) => 
    info.exists && info.isDirectory && info.hasIndexHtml
  );
  
  if (foundPath) {
    results.recommendations.push(`✓ Use path: ${foundPath[0]}`);
  } else {
    results.recommendations.push("✗ No valid dist/public directory found");
    results.recommendations.push("1. Check Vercel build logs - did 'npm run build' complete?");
    results.recommendations.push("2. Verify dist/public exists after build");
    results.recommendations.push("3. Check includeFiles pattern in vercel.json");
  }
  
  res.json(results);
});

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
