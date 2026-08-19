import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../../packages/schema/src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://sordi:sordi_dev_password@localhost:5434/sordi",
  },
});
