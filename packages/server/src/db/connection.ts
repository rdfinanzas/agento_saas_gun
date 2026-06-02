import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"
import { env } from "../config/env"

// Connection pool for queries
const connectionString = env.DATABASE_URL

export const pool = postgres(connectionString, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
})

// Drizzle instance with schema
export const db = drizzle(pool, { schema })

// Graceful shutdown
process.on("SIGINT", async () => {
  await pool.end()
  process.exit(0)
})

process.on("SIGTERM", async () => {
  await pool.end()
  process.exit(0)
})
