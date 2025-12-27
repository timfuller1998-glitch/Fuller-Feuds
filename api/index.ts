// Vercel-specific entry point (for Vercel deployments only)
// This file imports and re-exports the Express app from server/index.ts
// Note: For Render deployments, the server starts directly from server/index.ts
import app from "../server/index.js";

export default app;
