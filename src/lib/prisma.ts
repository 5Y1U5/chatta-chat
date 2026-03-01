import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

// シングルトン Prisma Client
// 開発時の HMR で複数インスタンスが作られないよう globalThis にキャッシュ

const globalForPrisma = globalThis as unknown as {
  _prisma: PrismaClient | undefined
  _pool: pg.Pool | undefined
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma._prisma) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    })
    globalForPrisma._pool = pool
    const adapter = new PrismaPg(pool)
    globalForPrisma._prisma = new PrismaClient({ adapter })
  }
  return globalForPrisma._prisma
}
