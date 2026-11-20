import { config } from "dotenv";
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from "../shared/schema.js";
import { validateConnectionString, logConnectionStringAccess, getConnectionStringInfo } from './utils/connectionRotation.js';
import { log } from './utils/logger.js';

// Load environment variables from .env file ONLY in local development
// In production, environment variables come from the hosting platform (Render, etc.)
const isProduction = process.env.NODE_ENV === 'production';
const shouldLoadEnv = !isProduction;

if (shouldLoadEnv) {
  console.log('[DB] Loading .env file for local development');
  config({ path: '.env', override: true });
} else {
  console.log(`[DB] Skipping .env load - Production: ${isProduction}`);
}

let connectionString = process.env.DATABASE_URL;

// Log environment info for debugging
console.error(`[DB CONNECTION] Environment check:`, {
  isProduction,
  shouldLoadEnv,
  hasDatabaseUrl: !!connectionString,
  databaseUrlLength: connectionString?.length,
  nodeEnv: process.env.NODE_ENV
});

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required. Please set your Supabase connection string in your .env file (local) or environment variables (production).');
}

// Validate connection string format
if (!validateConnectionString(connectionString)) {
  throw new Error('Invalid DATABASE_URL format. Connection string must be a valid PostgreSQL URL.');
}

// Log connection string access (masked)
logConnectionStringAccess('initialization');
const connectionInfo = getConnectionStringInfo();
if (connectionInfo) {
  log('Database connection initialized', 'db', 'info', {
    hostname: connectionInfo.hostname,
    port: connectionInfo.port,
    database: connectionInfo.database,
    isPooler: connectionInfo.isPooler,
  });
}

// Fix: Remove duplicate "DATABASE_URL=" prefix if it exists (copy-paste error)
if (connectionString.startsWith('DATABASE_URL=')) {
  connectionString = connectionString.replace('DATABASE_URL=', '');
  console.log('[DB] Removed a duplicate "DATABASE_URL=" prefix from the connection string');
}

// Trim any whitespace
const trimmedConnectionString = connectionString.trim();

try {
  const parsedUrl = new URL(trimmedConnectionString);
  const maskedUrl = `${parsedUrl.protocol}//${parsedUrl.username ? '***:***@' : ''}${parsedUrl.hostname}:${parsedUrl.port || '5432'}${parsedUrl.pathname}`;
  console.error(`[DB CONNECTION] Parsed hostname: ${parsedUrl.hostname}, port: ${parsedUrl.port || '5432'}, database: ${parsedUrl.pathname?.replace('/','')}`);
  console.error(`[DB CONNECTION] Full connection string (masked): ${maskedUrl}`);
} catch(e) {
  console.error(`[DB CONNECTION] Failed to parse connection string: ${e}`);
}

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

// Production-ready connection pool configuration
// Supabase requires SSL connections
// Prepared statements configuration:
// - Transaction mode: prepare: false (REQUIRED - Transaction mode doesn't support prepared statements)
// - Session mode: prepare: false (works, but prepare: true would be better - can enable via env var)
// - Direct connection: prepare: false (works, but prepare: true would be better - can enable via env var)
// 
// We default to prepare: false to ensure compatibility with Transaction mode.
// If using Session mode or Direct connection, you can enable prepared statements via DATABASE_USE_PREPARED_STATEMENTS=true
const url = new URL(trimmedConnectionString);
const usePreparedStatements = process.env.DATABASE_USE_PREPARED_STATEMENTS === 'true';
const connectionType = url.port === '6543' ? 'Pooler (port 6543)' : 'Direct (port 5432)';

console.error(`[DB CONNECTION] Connection type: ${connectionType}, Prepared statements: ${usePreparedStatements}`);

const client = postgres(trimmedConnectionString, {
  prepare: usePreparedStatements, // Default false for Transaction mode compatibility
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
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    const errorData = error instanceof Error ? {message:error.message,code:(error as any).code,errno:(error as any).errno,syscall:(error as any).syscall,hostname:(error as any).hostname} : {error:String(error)};
    console.error('[DB CONNECTION] Health check failed:', errorData);
    if ((error as any).hostname) {
      const hostname = (error as any).hostname;
      const isDirectConnection = hostname.includes('db.') && hostname.includes('.supabase.co');
      
      console.error(`[DB CONNECTION] ERROR: Cannot resolve Supabase hostname: ${hostname}`);
      console.error(`[DB CONNECTION] Error code: ${(error as any).code || 'UNKNOWN'}, Error: ${(error as any).message || 'Unknown error'}`);
      
      if (isDirectConnection) {
        console.error(`[DB CONNECTION] ⚠️  Using direct connection (db.*.supabase.co).`);
        console.error(`[DB CONNECTION] ⚠️  If you experience connection issues, consider using Connection Pooler instead.`);
        console.error(`[DB CONNECTION] ✅ To use pooler: Go to Supabase Dashboard → Settings → Database → Connection Pooling`);
        console.error(`[DB CONNECTION] ✅ Pooler format: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`);
      } else {
        console.error(`[DB CONNECTION] ACTION REQUIRED: Update DATABASE_URL environment variable with correct Supabase connection string`);
        console.error(`[DB CONNECTION] Get your connection string from: Supabase Dashboard → Settings → Database → Connection string`);
      }
    }
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
