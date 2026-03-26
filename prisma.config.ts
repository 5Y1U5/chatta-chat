import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // マイグレーションは直接接続を使用
    url: (process.env["DIRECT_URL"] || process.env["DATABASE_URL"] || "").trim(),
  },
})
