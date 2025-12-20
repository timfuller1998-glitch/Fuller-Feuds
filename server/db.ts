import { config } from "dotenv";
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from "../shared/schema.js";

// Load environment variables from .env file only in development
// In production (Vercel), environment variables are provided by the platform
if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
config({ path: '.env', override: true });
}

let connectionString = process.env.DATABASE_URL;

// #region agent log
fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.ts:12',message:'DATABASE_URL env var check',data:{hasValue:!!connectionString,length:connectionString?.length,isVercel:process.env.VERCEL==='1',nodeEnv:process.env.NODE_ENV},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

if (!connectionString) {
  const errorMsg = process.env.VERCEL === '1' 
    ? 'DATABASE_URL environment variable is required. Please set it in Vercel project settings (Settings → Environment Variables).'
    : 'DATABASE_URL environment variable is required. Please set it in your .env file or environment.';
  throw new Error(errorMsg);
}

// Fix: Remove duplicate "DATABASE_URL=" prefix if it exists (copy-paste error)
if (connectionString.startsWith('DATABASE_URL=')) {
  connectionString = connectionString.replace('DATABASE_URL=', '');
  console.log('Fixed duplicate prefix, new value:', connectionString.substring(0, 50));
}

// Trim any whitespace
const trimmedConnectionString = connectionString.trim();

// #region agent log
try {
  const url = new URL(trimmedConnectionString);
  const maskedUrl = `${url.protocol}//${url.username ? '***:***@' : ''}${url.hostname}:${url.port || '5432'}${url.pathname}`;
  console.error(`[DB CONNECTION] Parsed hostname: ${url.hostname}, port: ${url.port || '5432'}, database: ${url.pathname?.replace('/','')}`);
  console.error(`[DB CONNECTION] Full connection string (masked): ${maskedUrl}`);
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.ts:28',message:'Connection string parsed',data:{hostname:url.hostname,port:url.port||'5432',database:url.pathname?.replace('/',''),maskedUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
} catch(e) {
  console.error(`[DB CONNECTION] Failed to parse connection string: ${e}`);
  console.error(`[DB CONNECTION] First 100 chars of connection string: ${trimmedConnectionString.substring(0, 100)}`);
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.ts:28',message:'Failed to parse connection string',data:{error:String(e),first50:trimmedConnectionString.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
}
// #endregion

// Validate the connection string format
if (!trimmedConnectionString.startsWith('postgresql://') && !trimmedConnectionString.startsWith('postgres://')) {
  throw new Error(
    `Invalid DATABASE_URL format. Expected postgresql:// or postgres:// URL. ` +
    `Got: ${trimmedConnectionString.substring(0, 50)}... ` +
    `Make sure special characters in the password are URL-encoded.`
  );
}

// Try to validate it's a valid URI
try {
  new URL(trimmedConnectionString);
} catch (error) {
  throw new Error(
    `Invalid DATABASE_URL format: ${error instanceof Error ? error.message : 'URI malformed'}. ` +
    `Make sure the connection string is a valid PostgreSQL URL. ` +
    `Format: postgresql://user:password@host:port/database ` +
    `(Note: special characters in password must be URL-encoded)`
  );
}

// #region agent log
try {
  const url = new URL(trimmedConnectionString);
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.ts:52',message:'Creating postgres client',data:{hostname:url.hostname,port:url.port||'5432',maxConnections:process.env.DATABASE_MAX_CONNECTIONS||'10',connectTimeout:process.env.DATABASE_CONNECT_TIMEOUT||'10'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
} catch(e) {}
// #endregion

// Production-ready connection pool configuration
const client = postgres(trimmedConnectionString, {
  prepare: false, // Disable prepared statements for better connection reuse
  max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10', 10), // Max connections in pool
  idle_timeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '20', 10), // Close idle connections after 20s
  connect_timeout: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '10', 10), // Connection timeout
  onnotice: () => {}, // Ignore PostgreSQL notices to reduce log noise
});

export const db = drizzle(client, { schema });
export const pool = client;

// Health check function for monitoring
export const checkDbConnection = async (): Promise<boolean> => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.ts:64',message:'Health check started',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  try {
    await client`SELECT 1`;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.ts:66',message:'Health check succeeded',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    return true;
  } catch (error) {
    // #region agent log
    const errorData = error instanceof Error ? {message:error.message,code:(error as any).code,errno:(error as any).errno,syscall:(error as any).syscall,hostname:(error as any).hostname} : {error:String(error)};
    console.error('[DB CONNECTION] Health check failed:', errorData);
    if ((error as any).hostname) {
      console.error(`[DB CONNECTION] ERROR: Cannot resolve hostname: ${(error as any).hostname}`);
      console.error(`[DB CONNECTION] ACTION REQUIRED: Update DATABASE_URL in Vercel to use correct Supabase hostname`);
      console.error(`[DB CONNECTION] Expected format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`);
    }
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.ts:69',message:'Health check failed',data:errorData,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Database connection failed:', error);
    return false;
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  await client.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database connections...');
  await client.end();
  process.exit(0);
});
