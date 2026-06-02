// Database configuration
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "../db/schema"

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/agento"

// Create connection pool
const client = postgres(connectionString, {
  max: parseInt(process.env.DATABASE_POOL_SIZE || "10"),
})

// Create drizzle instance
export const db = drizzle(client, { schema })

// Helper for transactions - simplified for Drizzle ORM
export async function transaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
  return db.transaction(fn as any)
}
