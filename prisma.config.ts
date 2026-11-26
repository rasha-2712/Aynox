import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    // Allows client generation without requiring a running local database.
    // Database commands still need a real DATABASE_URL.
    url: process.env.DATABASE_URL ?? "postgresql://demo:demo@localhost:5432/aynox_dev?schema=public"
  }
});
