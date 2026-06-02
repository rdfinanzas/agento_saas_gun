/**
 * DB Query Tool
 * 
 * SP-4.2: Tool para consultar bases de datos externas del cliente
 * 
 * Features:
 * - Soporte PostgreSQL, MySQL, MongoDB
 * - Usa credenciales encriptadas del CredentialManager
 * - Solo queries SELECT permitidos (para modificaciones usar approval)
 * - Timeout configurable
 * - Requiere approval por seguridad
 */

import { z } from "zod"
import { credentialManager } from "@/modules/agent-ai/services"

export const dbQuerySchema = z.object({
  credentialId: z.string().uuid().describe("ID de la credencial de DB almacenada"),
  query: z.string().describe("Query SQL o comando MongoDB"),
  params: z.array(z.any()).optional().describe("Parámetros para el query (previene SQL injection)"),
  timeout: z.number().min(1000).max(60000).default(30000).describe("Timeout en ms"),
})

export type DbQueryInput = z.infer<typeof dbQuerySchema>

export interface DbQueryOutput {
  rows: any[]
  rowCount: number
  fields?: string[]
  executionTime: number
}

/**
 * Ejecuta un query en la base de datos del cliente
 * 
 * @requiresApproval true - Esta tool requiere aprobación del usuario
 * @security Solo permite SELECT queries
 */
export async function executeDbQuery(
  params: DbQueryInput,
  context: { tenantId: string }
): Promise<DbQueryOutput> {
  const { credentialId, query, params: queryParams, timeout } = params
  const { tenantId } = context

  const startTime = Date.now()

  // Validar que solo sea SELECT (seguridad básica)
  const normalizedQuery = query.trim().toUpperCase()
  const isSelect = normalizedQuery.startsWith("SELECT") || 
                   normalizedQuery.startsWith("WITH") ||
                   normalizedQuery.startsWith("EXPLAIN") ||
                   normalizedQuery.startsWith("SHOW")
  
  if (!isSelect) {
    throw new Error(
      "Solo se permiten queries SELECT. " +
      "Para INSERT, UPDATE, DELETE, CREATE, DROP, etc. usar el workflow de aprobación."
    )
  }

  // Obtener credenciales desencriptadas
  const cred = await credentialManager.getCredential(credentialId, tenantId)
  if (!cred) {
    throw new Error("Credencial no encontrada o no pertenece al tenant")
  }

  try {
    switch (cred.type) {
      case "postgresql": {
        const postgres = await import("postgres")
        const connectionString = cred.connectionString || 
          `postgresql://${cred.username}:${cred.password}@${cred.host}:${cred.port}/${cred.database}`
        
        const sql = postgres.default(connectionString, {
          max: 1,
          connect_timeout: Math.floor(timeout / 1000),
          idle_timeout: 20,
        })

        const result = await sql.unsafe(query, queryParams || [])
        await sql.end()

        const executionTime = Date.now() - startTime

        return {
          rows: Array.isArray(result) ? result : [result],
          rowCount: Array.isArray(result) ? result.length : 1,
          executionTime,
        }
      }

      case "mysql":
      case "mariadb": {
        const mysql = await import("mysql2/promise")
        const connection = await mysql.createConnection({
          host: cred.host,
          port: parseInt(cred.port),
          database: cred.database,
          user: cred.username,
          password: cred.password,
          connectTimeout: timeout,
        })

        const [rows, fields] = await connection.execute(query, queryParams || [])
        await connection.end()

        const executionTime = Date.now() - startTime

        return {
          rows: Array.isArray(rows) ? rows : [rows],
          rowCount: Array.isArray(rows) ? rows.length : 1,
          fields: fields ? (fields as any[]).map(f => f.name) : undefined,
          executionTime,
        }
      }

      case "mongodb": {
        const { MongoClient } = await import("mongodb")
        const connectionString = cred.connectionString ||
          `mongodb://${cred.username}:${cred.password}@${cred.host}:${cred.port}/${cred.database}`

        const client = new MongoClient(connectionString, {
          connectTimeoutMS: timeout,
          serverSelectionTimeoutMS: timeout,
        })

        await client.connect()
        const db = client.db(cred.database)

        // Para MongoDB, el "query" es el nombre de la colección
        // y los params son el filtro
        const collectionName = query.trim()
        const filter = queryParams?.[0] || {}
        
        const documents = await db
          .collection(collectionName)
          .find(filter)
          .limit(1000)
          .toArray()

        await client.close()

        const executionTime = Date.now() - startTime

        return {
          rows: documents,
          rowCount: documents.length,
          executionTime,
        }
      }

      default:
        throw new Error(`Tipo de base de datos no soportado: ${cred.type}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`DB query failed: ${error.message}`)
    }
    throw error
  }
}

export const dbQueryTool = {
  name: "db_query",
  description: "Ejecuta queries SELECT en bases de datos PostgreSQL, MySQL o MongoDB. Usa credenciales almacenadas previamente. Solo lectura permitida.",
  requiresApproval: true,
  schema: dbQuerySchema,
  execute: executeDbQuery,
}
