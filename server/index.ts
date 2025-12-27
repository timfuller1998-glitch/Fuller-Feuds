import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import routes from "./routes/index.js";
import { serveStatic, log } from "./vite.js";
// Force inclusion of static files by importing
import "./static-loader.js";
// Import static-files to ensure server/static directory is included
import { staticIndexHtml } from "./static-files.js";
// Access it to ensure it's not tree-shaken
void staticIndexHtml;
import { startScheduledJobs } from "./scheduled-jobs.js";
import { BadgeRepository } from "./repositories/badgeRepository.js";
import { setupAuth } from "./auth.js";
import { attachUserRole } from "./middleware/permissions.js";
import { getCacheStats } from "./services/cacheService.js";
import { setupWebSocketServer } from "./websocket.js";

const badgeRepository = new BadgeRepository();

const app = express();

// Trust proxy to get correct protocol (HTTPS) from x-forwarded-proto header
// This is critical for secure cookies to work correctly in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Log request info for debugging (optional - can be enabled via env var)
app.use((req, res, next) => {
  if (process.env.LOG_REQUESTS === 'true') {
    console.log(`[REQUEST] ${req.method} ${req.path} - Host: ${req.hostname}, Origin: ${req.get('origin')}, Protocol: ${req.protocol}, X-Forwarded-Proto: ${req.get('x-forwarded-proto')}`);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from public folder (for PWA files: service-worker.js, manifest.json, icons)
const publicPath = path.resolve(import.meta.dirname, "..", "public");
app.use(express.static(publicPath));

// Ensure service worker is never cached - critical for PWA updates
app.get('/service-worker.js', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

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

// Diagnostic route to check served HTML
app.get('/api/debug/html', (req, res) => {
  const cwd = process.cwd();
  const dirname = import.meta.dirname;
  
  const possibleHtmlPaths = [
    path.resolve(cwd, "dist", "public", "index.html"),
    path.resolve(dirname, "static", "index.html"),
    path.resolve(dirname, "..", "dist", "public", "index.html"),
  ];
  
  let htmlContent = null;
  let htmlPath = null;
  
  for (const htmlPathCheck of possibleHtmlPaths) {
    if (fs.existsSync(htmlPathCheck)) {
      try {
        htmlContent = fs.readFileSync(htmlPathCheck, 'utf-8');
        htmlPath = htmlPathCheck;
        break;
      } catch (e) {
        // Continue to next path
      }
    }
  }
  
  if (htmlContent) {
    // Extract asset references from HTML
    const jsMatches = htmlContent.match(/<script[^>]*src=["']([^"']+)["']/g) || [];
    const cssMatches = htmlContent.match(/<link[^>]*href=["']([^"']+)["']/g) || [];
    
    res.json({
      htmlPath,
      htmlLength: htmlContent.length,
      htmlPreview: htmlContent.substring(0, 500),
      assetReferences: {
        scripts: jsMatches,
        stylesheets: cssMatches,
      },
      hostname: req.hostname,
      protocol: req.protocol,
    });
  } else {
    res.json({
      error: 'HTML not found',
      checkedPaths: possibleHtmlPaths,
      hostname: req.hostname,
    });
  }
});

// Diagnostic route to check static file setup
app.get('/api/debug/static', (req, res) => {
  const cwd = process.cwd();
  const dirname = import.meta.dirname;
  
  const pathsToCheck = [
    path.resolve(dirname, "static"), // Check server/static first (copied during build)
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
  
  // Also check what's in the server directory (to see if static exists)
  const serverDirPath = path.resolve(dirname);
  if (fs.existsSync(serverDirPath)) {
    try {
      const serverContents = fs.readdirSync(serverDirPath);
      results.serverContents = serverContents.slice(0, 50);
    } catch (e: any) {
      results.serverReadError = e.message;
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
    results.recommendations.push("1. Check build logs - did 'npm run build' complete?");
    results.recommendations.push("2. Verify dist/public exists after build");
    results.recommendations.push("3. Ensure build process copies files correctly");
  }
  
  res.json(results);
});

// Create HTTP server
const server = createServer(app);

// Setup WebSocket server
setupWebSocketServer(server);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  log(`Error: ${message}`, "error");
  res.status(status).json({ message });
  // Don't re-throw in production
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

// Health check endpoint for Render monitoring
app.get('/health', async (req, res) => {
  try {
    const { checkDbConnection } = await import('./db.js');
    const dbHealthy = await checkDbConnection();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'connected' : 'disconnected',
      websocket: 'enabled'
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Start the server
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
