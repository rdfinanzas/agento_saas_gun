/**
 * DB Credentials Schema
 *
 * Almacena credenciales de bases de datos de clientes de forma segura.
 * Los campos sensibles (password, connectionString) se encriptan con AES-256-GCM.
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  json,
  index,
} from "drizzle-orm/pg-core"

// Tipos de bases de datos soportadas
export const dbCredentialTypeEnum = ["postgresql", "mysql", "mongodb", "mariadb", "sqlite"] as const
export type DbCredentialType = typeof dbCredentialTypeEnum[number]

// Configuración adicional para conexiones (SSL, timeouts, etc.)
export type DbCredentialConfig = {
  ssl?: boolean
  sslRejectUnauthorized?: boolean
  connectTimeout?: number
  schema?: string // Para PostgreSQL
  authSource?: string // Para MongoDB
  replicaSet?: string // Para MongoDB
  extraOptions?: Record<string, unknown>
}

export const dbCredentials = pgTable(
  "db_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),

    // Identificación
    name: text("name").notNull(), // ej: "DB Produccion", "DB Testing"
    description: text("description"),

    // Tipo de base de datos
    type: text("type").notNull(), // postgresql, mysql, mongodb, mariadb, sqlite

    // Campos de conexión (password se encripta)
    host: text("host").notNull(),
    port: text("port").notNull(),
    database: text("database").notNull(),
    username: text("username").notNull(),
    password: text("password").notNull(), // ENCRIPTADO con AES-256-GCM

    // Connection string alternativo (también encriptado)
    connectionString: text("connection_string"), // ENCRIPTADO

    // Configuración adicional (SSL, timeouts, etc.)
    config: json("config").$type<DbCredentialConfig>(),

    // Estado
    isActive: boolean("is_active").default(true).notNull(),

    // Última prueba de conexión
    lastTestAt: timestamp("last_test_at"),
    lastTestStatus: text("last_test_status"), // success, failed
    lastTestError: text("last_test_error"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("db_credentials_tenant_id_idx").on(table.tenantId),
    typeIdx: index("db_credentials_type_idx").on(table.type),
    isActiveIdx: index("db_credentials_is_active_idx").on(table.isActive),
    nameIdx: index("db_credentials_name_idx").on(table.name),
  })
)

// Type exports
export type DbCredential = typeof dbCredentials.$inferSelect
export type NewDbCredential = typeof dbCredentials.$inferInsert

// Tipo para credenciales desencriptadas (usado internamente)
export type DecryptedDbCredential = Omit<DbCredential, "password" | "connectionString"> & {
  password: string
  connectionString?: string
}
