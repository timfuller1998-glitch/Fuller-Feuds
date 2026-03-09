import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config();

// PostgreSQL configuration for production-ready database
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
