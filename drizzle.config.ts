import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!, // mysql://admin:_Admin123_@localhost:3306/tracerstudy
  },
  verbose: true,
  strict: true,
});
