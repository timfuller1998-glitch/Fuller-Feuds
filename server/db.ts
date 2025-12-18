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
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
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
