/**
 * Credential Manager Service
 *
 * Gestiona las credenciales de bases de datos de clientes.
 * Las credenciales se almacenan encriptadas con AES-256-GCM.
 */
import { db } from "@/db"
import {
  dbCredentials,
  type DbCredential,
  type NewDbCredential,
  type DbCredentialConfig,
  type DecryptedDbCredential,
} from "@/db/schema/db-credential"
import { eq, and } from "drizzle-orm"
import {
  encryptionService,
  encryptCredentials,
  decryptCredentials,
  type DbCredentialInput,
} from "./encryption.service"

export type CreateCredentialInput = {
  name: string
  description?: string
  type: string
  host: string
  port: string | number
  database: string
  username: string
  password: string
  connectionString?: string
  config?: DbCredentialConfig
}

export type UpdateCredentialInput = Partial<
  Pick<
    CreateCredentialInput,
    "name" | "description" | "host" | "port" | "database" | "username" | "password" | "connectionString" | "config"
  >
>

export class CredentialManager {
  /**
   * Crea una nueva credencial de DB
   * Encripta password y connectionString antes de guardar
   */
  async createCredential(
    tenantId: string,
    data: CreateCredentialInput
  ): Promise<DbCredential> {
    // Encriptar credenciales sensibles
    const encrypted = encryptCredentials({
      host: data.host,
      port: data.port,
      database: data.database,
      username: data.username,
      password: data.password,
      connectionString: data.connectionString,
    })

    const [credential] = await db
      .insert(dbCredentials)
      .values({
        tenantId,
        name: data.name,
        description: data.description,
        type: data.type,
        host: encrypted.host,
        port: encrypted.port,
        database: encrypted.database,
        username: encrypted.username,
        password: encrypted.password,
        connectionString: encrypted.connectionString,
        config: data.config,
        isActive: true,
      })
      .returning()

    console.log(`[CredentialManager] Created credential "${data.name}" for tenant ${tenantId}`)

    return credential
  }

  /**
   * Obtiene una credencial desencriptada
   * Solo retorna si pertenece al tenant
   */
  async getCredential(
    credentialId: string,
    tenantId: string
  ): Promise<DecryptedDbCredential | null> {
    const cred = await db.query.dbCredentials.findFirst({
      where: and(
        eq(dbCredentials.id, credentialId),
        eq(dbCredentials.tenantId, tenantId),
        eq(dbCredentials.isActive, true)
      ),
    })

    if (!cred) {
      return null
    }

    // Desencriptar password y connectionString
    const decrypted = decryptCredentials({
      password: cred.password,
      connectionString: cred.connectionString ?? undefined,
    })

    return {
      ...cred,
      password: decrypted.password,
      connectionString: decrypted.connectionString,
    }
  }

  /**
   * Obtiene una credencial sin desencriptar (para mostrar en listas)
   * No incluye password ni connectionString
   */
  async getCredentialSafe(
    credentialId: string,
    tenantId: string
  ): Promise<Omit<DbCredential, "password" | "connectionString"> | null> {
    const cred = await db.query.dbCredentials.findFirst({
      where: and(
        eq(dbCredentials.id, credentialId),
        eq(dbCredentials.tenantId, tenantId),
        eq(dbCredentials.isActive, true)
      ),
      columns: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        type: true,
        host: true,
        port: true,
        database: true,
        username: true,
        config: true,
        isActive: true,
        lastTestAt: true,
        lastTestStatus: true,
        lastTestError: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return cred ?? null
  }

  /**
   * Lista todas las credenciales de un tenant
   * NO incluye passwords ni connectionStrings
   */
  async listCredentials(
    tenantId: string
  ): Promise<Omit<DbCredential, "password" | "connectionString">[]> {
    return db.query.dbCredentials.findMany({
      where: and(
        eq(dbCredentials.tenantId, tenantId),
        eq(dbCredentials.isActive, true)
      ),
      columns: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        type: true,
        host: true,
        port: true,
        database: true,
        username: true,
        config: true,
        isActive: true,
        lastTestAt: true,
        lastTestStatus: true,
        lastTestError: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: (credentials, { desc }) => [desc(credentials.createdAt)],
    })
  }

  /**
   * Actualiza una credencial
   * Si se incluye password o connectionString, los encripta
   */
  async updateCredential(
    credentialId: string,
    tenantId: string,
    data: UpdateCredentialInput
  ): Promise<DbCredential | null> {
    // Verificar que existe y pertenece al tenant
    const existing = await db.query.dbCredentials.findFirst({
      where: and(
        eq(dbCredentials.id, credentialId),
        eq(dbCredentials.tenantId, tenantId),
        eq(dbCredentials.isActive, true)
      ),
    })

    if (!existing) {
      return null
    }

    // Preparar datos de actualización
    const updateData: Partial<NewDbCredential> = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.host !== undefined) updateData.host = data.host
    if (data.port !== undefined) updateData.port = String(data.port)
    if (data.database !== undefined) updateData.database = data.database
    if (data.username !== undefined) updateData.username = data.username
    if (data.config !== undefined) updateData.config = data.config

    // Encriptar password si se proporciona
    if (data.password !== undefined) {
      const encrypted = encryptionService.encrypt(data.password)
      updateData.password = encrypted
    }

    // Encriptar connectionString si se proporciona
    if (data.connectionString !== undefined) {
      updateData.connectionString = data.connectionString
        ? encryptionService.encrypt(data.connectionString)
        : null
    }

    const [updated] = await db
      .update(dbCredentials)
      .set(updateData)
      .where(eq(dbCredentials.id, credentialId))
      .returning()

    console.log(`[CredentialManager] Updated credential "${existing.name}" for tenant ${tenantId}`)

    return updated
  }

  /**
   * Elimina una credencial (soft delete)
   */
  async deleteCredential(credentialId: string, tenantId: string): Promise<boolean> {
    const result = await db
      .update(dbCredentials)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dbCredentials.id, credentialId),
          eq(dbCredentials.tenantId, tenantId)
        )
      )
      .returning()

    if (result.length > 0) {
      console.log(`[CredentialManager] Deleted credential for tenant ${tenantId}`)
      return true
    }

    return false
  }

  /**
   * Prueba la conexión a una base de datos
   */
  async testConnection(
    credentialId: string,
    tenantId: string
  ): Promise<{ success: boolean; error?: string; latency?: number }> {
    const cred = await this.getCredential(credentialId, tenantId)

    if (!cred) {
      return { success: false, error: "Credential not found" }
    }

    const startTime = Date.now()

    try {
      // Importar el cliente de DB según el tipo
      let client: any

      switch (cred.type) {
        case "postgresql": {
          const postgres = await import("postgres")
          const connectionString =
            cred.connectionString ??
            `postgresql://${cred.username}:${cred.password}@${cred.host}:${cred.port}/${cred.database}`

          client = postgres(connectionString, {
            max: 1,
            connect_timeout: 10,
          })

          // Test query
          await client`SELECT 1`
          await client.end()
          break
        }

        case "mysql":
        case "mariadb": {
          const mysql = await import("mysql2/promise")
          client = await mysql.createConnection({
            host: cred.host,
            port: parseInt(cred.port),
            database: cred.database,
            user: cred.username,
            password: cred.password,
            connectTimeout: 10000,
          })

          await client.execute("SELECT 1")
          await client.end()
          break
        }

        case "mongodb": {
          const { MongoClient } = await import("mongodb")
          const connectionString =
            cred.connectionString ??
            `mongodb://${cred.username}:${cred.password}@${cred.host}:${cred.port}/${cred.database}`

          client = new MongoClient(connectionString, {
            connectTimeoutMS: 10000,
          })

          await client.connect()
          await client.db().command({ ping: 1 })
          await client.close()
          break
        }

        default:
          return { success: false, error: `Unsupported database type: ${cred.type}` }
      }

      const latency = Date.now() - startTime

      // Actualizar estado de prueba
      await db
        .update(dbCredentials)
        .set({
          lastTestAt: new Date(),
          lastTestStatus: "success",
          lastTestError: null,
          updatedAt: new Date(),
        })
        .where(eq(dbCredentials.id, credentialId))

      return { success: true, latency }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      // Actualizar estado de prueba
      await db
        .update(dbCredentials)
        .set({
          lastTestAt: new Date(),
          lastTestStatus: "failed",
          lastTestError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(dbCredentials.id, credentialId))

      return { success: false, error: errorMessage }
    }
  }

  /**
   * Obtiene la cadena de conexión formateada para un tipo de DB específico
   */
  async getConnectionString(
    credentialId: string,
    tenantId: string
  ): Promise<string | null> {
    const cred = await this.getCredential(credentialId, tenantId)

    if (!cred) {
      return null
    }

    // Si hay connection string personalizado, usarlo
    if (cred.connectionString) {
      return cred.connectionString
    }

    // Generar connection string según el tipo
    switch (cred.type) {
      case "postgresql":
        return `postgresql://${cred.username}:${cred.password}@${cred.host}:${cred.port}/${cred.database}`

      case "mysql":
      case "mariadb":
        return `mysql://${cred.username}:${cred.password}@${cred.host}:${cred.port}/${cred.database}`

      case "mongodb":
        return `mongodb://${cred.username}:${cred.password}@${cred.host}:${cred.port}/${cred.database}`

      case "sqlite":
        return cred.database // SQLite usa path del archivo

      default:
        return null
    }
  }
}

// Singleton instance
export const credentialManager = new CredentialManager()
