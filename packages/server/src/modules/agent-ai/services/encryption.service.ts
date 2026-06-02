/**
 * Encryption Service
 *
 * Servicio de encriptación usando AES-256-GCM.
 * Usado para proteger credenciales de bases de datos de clientes.
 *
 * IMPORTANTE: La clave de encriptación debe estar en ENCRYPTION_KEY env var.
 * Si no existe, se genera una clave aleatoria (NO recomendado para producción).
 */
import * as crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

// Clave de encriptación desde env o generar una temporal
const getEncryptionKey = (): Buffer => {
  const keyFromEnv = process.env.ENCRYPTION_KEY

  if (keyFromEnv) {
    // La clave debe ser de 64 caracteres hex (32 bytes)
    if (keyFromEnv.length === 64 && /^[0-9a-f]{64}$/i.test(keyFromEnv)) {
      return Buffer.from(keyFromEnv, "hex")
    }
    // Si no tiene el formato correcto, derivar una clave
    return crypto.createHash("sha256").update(keyFromEnv).digest()
  }

  // Advertencia: clave temporal (no usar en producción)
  console.warn(
    "WARNING: ENCRYPTION_KEY not set or invalid. Using temporary key. " +
      "This is NOT secure for production! Set ENCRYPTION_KEY env var with a 64-char hex string."
  )
  return crypto.randomBytes(KEY_LENGTH)
}

let encryptionKey: Buffer = getEncryptionKey()

/**
 * Resetea la clave de encriptación (útil para tests)
 */
export const resetEncryptionKey = (newKey?: string) => {
  if (newKey) {
    process.env.ENCRYPTION_KEY = newKey
  }
  encryptionKey = getEncryptionKey()
}

/**
 * Encripta un texto con AES-256-GCM
 *
 * @param text - Texto a encriptar
 * @returns Texto encriptado en formato "iv:authTag:encrypted" (hex)
 */
export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv)

  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag()

  // Formato: iv:authTag:encrypted (todos en hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
}

/**
 * Desencripta un texto encriptado
 *
 * @param encryptedText - Texto en formato "iv:authTag:encrypted"
 * @returns Texto original desencriptado
 * @throws Error si el texto está corrupto o la clave es incorrecta
 */
export const decrypt = (encryptedText: string): string => {
  const parts = encryptedText.split(":")

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format. Expected 'iv:authTag:encrypted'")
  }

  const [ivHex, authTagHex, encrypted] = parts

  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length")
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid auth tag length")
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

/**
 * Tipo para credenciales de DB
 */
export type DbCredentialInput = {
  host: string
  port: string | number
  database: string
  username: string
  password: string
  connectionString?: string
}

export type DbCredentialEncrypted = {
  host: string
  port: string
  database: string
  username: string
  password: string // Encriptado
  connectionString?: string // Encriptado
}

/**
 * Encripta las partes sensibles de las credenciales de DB
 *
 * @param credentials - Credenciales con password en texto plano
 * @returns Credenciales con password y connectionString encriptados
 */
export const encryptCredentials = (credentials: DbCredentialInput): DbCredentialEncrypted => {
  return {
    host: credentials.host,
    port: String(credentials.port),
    database: credentials.database,
    username: credentials.username,
    password: encrypt(credentials.password),
    connectionString: credentials.connectionString
      ? encrypt(credentials.connectionString)
      : undefined,
  }
}

/**
 * Desencripta las partes sensibles de las credenciales de DB
 *
 * @param encrypted - Credenciales con password encriptado
 * @returns Credenciales con password en texto plano
 */
export const decryptCredentials = (
  encrypted: Pick<DbCredentialEncrypted, "password" | "connectionString">
): { password: string; connectionString?: string } => {
  return {
    password: decrypt(encrypted.password),
    connectionString: encrypted.connectionString
      ? decrypt(encrypted.connectionString)
      : undefined,
  }
}

/**
 * Genera una clave de encriptación aleatoria para usar en ENCRYPTION_KEY
 * Útil para configuración inicial
 */
export const generateEncryptionKey = (): string => {
  return crypto.randomBytes(KEY_LENGTH).toString("hex")
}

/**
 * Verifica si una cadena parece estar encriptada
 */
export const isEncrypted = (text: string): boolean => {
  const parts = text.split(":")
  if (parts.length !== 3) return false

  const [iv, authTag, encrypted] = parts

  // Verificar que todas las partes son hex válidos
  const hexRegex = /^[0-9a-f]+$/i
  return hexRegex.test(iv) && hexRegex.test(authTag) && hexRegex.test(encrypted)
}

/**
 * EncryptionService class para uso orientado a objetos
 */
export class EncryptionService {
  encrypt = encrypt
  decrypt = decrypt
  encryptCredentials = encryptCredentials
  decryptCredentials = decryptCredentials
  generateEncryptionKey = generateEncryptionKey
  isEncrypted = isEncrypted
  resetKey = resetEncryptionKey
}

export const encryptionService = new EncryptionService()
