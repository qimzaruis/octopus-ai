import { defineConfig } from "drizzle-kit";
import "./src/lib/dotenv";
import { normalizeDbUrl } from "./src/lib/db-url";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: normalizeDbUrl(process.env.DATABASE_URL ?? ""),
  },
});