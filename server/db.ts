import { config } from "dotenv";
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from "../shared/schema.js";

// Load environment variables from .env file ONLY in local development
// NEVER load .env in Vercel/production - environment variables come from Vercel dashboard
// Vercel sets VERCEL=1, so we check for that first
const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production';
const shouldLoadEnv = !isVercel && !isProduction;

if (shouldLoadEnv) {
  console.log('[DB] Loading .env file for local development');
  config({ path: '.env', override: true });
} else {
  console.log(`[DB] Skipping .env load - Vercel: ${isVercel}, Production: ${isProduction}`);
}

let connectionString = process.env.DATABASE_URL;

// Log environment info for debugging
console.error(`[DB CONNECTION] Environment check:`, {
  isVercel,
  isProduction,
  shouldLoadEnv,
  hasDatabaseUrl: !!connectionString,
  databaseUrlLength: connectionString?.length,
  nodeEnv: process.env.NODE_ENV,
  vercelEnv: process.env.VERCEL
});

// #region agent log
fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.ts:12',message:'DATABASE_URL env var check',data:{hasValue:!!connectionString,length:connectionString?.length,isVercel:process.env.VERCEL==='1',nodeEnv:process.env.NODE_ENV},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

if (!connectionString) {
  const errorMsg = process.env.VERCEL === '1' 
    ? 'DATABASE_URL environment variable is required. Please set your Supabase connection string in Vercel project settings (Settings → Environment Variables). The database is Supabase, not Vercel - you just need to configure the connection string in Vercel\'s environment variables.'
    : 'DATABASE_URL environment variable is required. Please set your Supabase connection string in your .env file or environment.';
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
// Supabase requires SSL connections
// Detect connection mode from connection string:
// - Transaction mode (port 6543): prepare: false (required)
// - Session mode (port 6543): prepare: true (optional, better performance)
// - Direct connection (port 5432): prepare: true (optional, better performance)
const url = new URL(trimmedConnectionString);
const isTransactionPooler = url.port === '6543' && url.hostname.includes('pooler');
const isSessionPooler = url.port === '6543' && url.hostname.includes('pooler') && !isTransactionPooler;
const usePreparedStatements = !isTransactionPooler; // Only disable for Transaction mode

console.error(`[DB CONNECTION] Connection mode: ${isTransactionPooler ? 'Transaction Pooler' : isSessionPooler ? 'Session Pooler' : 'Direct'}, Prepared statements: ${usePreparedStatements}`);

const client = postgres(trimmedConnectionString, {
  prepare: usePreparedStatements, // Disable for Transaction mode, enable for Session/Direct
  max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10', 10), // Max connections in pool
  idle_timeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '20', 10), // Close idle connections after 20s
  connect_timeout: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '10', 10), // Connection timeout
  ssl: 'require', // Supabase requires SSL connections
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
      console.error(`[DB CONNECTION] ERROR: Cannot resolve Supabase hostname: ${(error as any).hostname}`);
      console.error(`[DB CONNECTION] The database IS Supabase - this is a connection issue, not a Vercel database issue.`);
      console.error(`[DB CONNECTION] ACTION REQUIRED: Update DATABASE_URL in Vercel environment variables to use correct Supabase connection string`);
      console.error(`[DB CONNECTION] Expected format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`);
      console.error(`[DB CONNECTION] Get your connection string from: Supabase Dashboard → Settings → Database → Connection string`);
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
