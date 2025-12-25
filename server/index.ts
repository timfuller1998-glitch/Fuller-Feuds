import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import routes from "./routes/index.js";
import { serveStatic, log } from "./vite.js";
// Force inclusion of static files by importing
import "./static-loader.js";
// Import static-files to force Vercel to include server/static directory
import { staticIndexHtml } from "./static-files.js";
// Access it to ensure it's not tree-shaken
void staticIndexHtml;
import { startScheduledJobs } from "./scheduled-jobs.js";
import { BadgeRepository } from "./repositories/badgeRepository.js";
import { setupAuth } from "./auth.js";
import { attachUserRole } from "./middleware/permissions.js";
import { getCacheStats } from "./services/cacheService.js";

const badgeRepository = new BadgeRepository();

const app = express();

// Trust Vercel's proxy to get correct protocol (HTTPS) from x-forwarded-proto header
// This is critical for secure cookies to work correctly
if (process.env.VERCEL === '1') {
  app.set('trust proxy', 1);
}

// Log request info for debugging domain issues
app.use((req, res, next) => {
  // Only log in production to help debug domain issues
  if (process.env.VERCEL === '1') {
    console.log(`[REQUEST] ${req.method} ${req.path} - Host: ${req.hostname}, Origin: ${req.get('origin')}, Protocol: ${req.protocol}, X-Forwarded-Proto: ${req.get('x-forwarded-proto')}`);
  }
  next();
});

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
// #region agent log
const logData = {location:'server/index.ts:240',message:'Server module loaded',data:{nodeEnv:process.env.NODE_ENV,vercel:process.env.VERCEL,hasRoutes:!!routes},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
console.log('[DEBUG]', JSON.stringify(logData));
fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
// #endregion
export default app;
