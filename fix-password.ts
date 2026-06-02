import { hash } from "bcrypt"
import postgres from "postgres"

const h = await hash("admin123", 10)
console.log("Generated hash:", h)

const sql = postgres("postgresql://agento_pg:Ag3ntoSaaS2024!@postgres:5432/agento_saas")
await sql`UPDATE users SET passwordhash = ${h} WHERE email = 'admin@agento.com'`
console.log("Password updated!")

const rows = await sql`SELECT email, passwordhash FROM users WHERE email = 'admin@agento.com'`
console.log("Verified:", rows[0])

await sql.end()
