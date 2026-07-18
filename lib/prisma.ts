import { PrismaClient } from './generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Read database URL
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.warn("⚠️ DATABASE_URL is not defined in the environment. Prisma initialization may fail.")
}

// Setup PG Pool and Driver Adapter for Prisma 7
const pool = connectionString ? new Pool({ connectionString }) : null
const adapter = pool ? new PrismaPg(pool) : null

export const prisma =
  globalForPrisma.prisma ??
  (adapter
    ? new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      })
    : (null as unknown as PrismaClient))

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
