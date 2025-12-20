// Vercel auto-detects functions in the api directory
// This file imports and re-exports the Express app from server/index.ts
import app from "../server/index.js";

export default app;
