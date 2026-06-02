/**
 * SecureStorage - Almacenamiento Segure de credenciales
 * Adaptado desde Accomplish/OpenCode para multi-tenant
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SecureStorageOptions {
  storagePath: string;
  appId: string;
  encryptionKey?: string;
}

export interface StoredCredential {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sistema de almacenamiento seguro usando AES-256-GCM
 */
export class SecureStorage {
  private storagePath: string;
  private appId: string;
  private algorithm = 'aes-256-gcm';
  private keyLength = 32;
  private ivLength = 16;
  private authTagLength = 16;

  constructor(options: SecureStorageOptions) {
    this.storagePath = options.storagePath;
    this.appId = options.appId;
    this.ensureStorageDirectory();
  }

  /**
   * Asegura que el directorio de almacenamiento existe
   */
  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  /**
   * Deriva una clave de encriptación desde datos de la máquina y appId
   */
  private deriveKey(): Buffer {
    const machineId = this.getMachineIdentifier();
    const secret = `${machineId}-${this.appId}`;
    return crypto.scryptSync(secret, 'salt', 32) as Buffer;
  }

  /**
   * Obtiene un identificador único de la máquina
   */
  private getMachineIdentifier(): string {
    const hostname = os.hostname() || 'unknown';
    const platform = os.platform() || 'unknown';
    const cpus = os.cpus().length || 0;
    return `${hostname}-${platform}-${cpus}`;
  }

  /**
   * Encripta datos
   */
  private encrypt(data: string, key: Buffer): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(this.ivLength);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = cipher.update(data, 'utf8', 'hex');
    cipher.final(); // IMPORTANTE: procesar todos los datos antes de getAuthTag
    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Desencripta datos
   */
  private decrypt(encryptedData: string, iv: string, authTag: string, key: Buffer): string {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'hex'),
      Buffer.from(authTag, 'hex')
    );

    const decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    return decrypted;
  }

  /**
   * Obtiene la ruta del archivo de credenciales
   */
  private getCredentialPath(tenantId: string, provider: string): string {
    return path.join(this.storagePath, tenantId, `${provider}.json`);
  }

  /**
   * Almacena una API key para un proveedor
   */
  async storeApiKey(
    tenantId: string,
    provider: string,
    apiKey: string,
    baseUrl?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const key = this.deriveKey();
    const credential: StoredCredential = {
      provider,
      apiKey,
      baseUrl,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };


    const { encrypted, iv, authTag } = this.encrypt(JSON.stringify(credential), key);

    const filePath = this.getCredentialPath(tenantId, provider);
    const tempPath = `${filePath}.tmp`;

    const data = {
      encrypted,
      iv,
      authTag,
    };

    // Asegurar que el directorio existe
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    // Escribir a archivo temporal primero
    await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2));

    // Renombrar al archivo final (operación atómica)
    await fs.promises.rename(tempPath, filePath);
  }

  /**
   * Obtiene una API key almacenada
   */
  async getApiKey(
    tenantId: string,
    provider: string
  ): Promise<StoredCredential | null> {
    try {
      const filePath = this.getCredentialPath(tenantId, provider);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      const key = this.deriveKey();

      const decrypted = this.decrypt(data.encrypted, data.iv, data.authTag, key);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error(`Error reading credential for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Elimina una API key almacenada
   */
  async deleteApiKey(tenantId: string, provider: string): Promise<boolean> {
    try {
      const filePath = this.getCredentialPath(tenantId, provider);

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }

      return true;
    } catch (error) {
      console.error(`Error deleting credential for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Lista todos los proveedores configurados para un tenant
   */
  async listProviders(tenantId: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.storagePath);
      const tenantFiles = files.filter((f) => f.startsWith(`${tenantId}_`));
      return tenantFiles.map((f) => f.replace(`${tenantId}_`, '').replace('.json', ''));
    } catch (error) {
      console.error('Error listing providers:', error);
      return [];
    }
  }

  /**
   * Almacena tokens OAuth para un conector
   */
  async storeConnectorTokens(
    tenantId: string,
    connectorId: string,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const key = this.deriveKey();
    const data = {
      connectorId,
      tokens,
      createdAt: new Date().toISOString(),
    };

    const { encrypted, iv, authTag } = this.encrypt(JSON.stringify(data), key);
    const filePath = path.join(this.storagePath, tenantId, `connector_${connectorId}.json`);
    const tempPath = `${filePath}.tmp`;

    await fs.promises.writeFile(tempPath, JSON.stringify({ encrypted, iv, authTag }, null, 2));
    await fs.promises.rename(tempPath, filePath);
  }

  /**
   * Obtiene tokens OAuth de un connector
   */
  async getConnectorTokens(
    tenantId: string,
    connectorId: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: number } | null> {
    try {
      const filePath = path.join(this.storagePath, tenantId, `connector_${connectorId}.json`);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      const key = this.deriveKey();

      const decrypted = this.decrypt(data.encrypted, data.iv, data.authTag, key);
      const parsed = JSON.parse(decrypted);
      return parsed.tokens;
    } catch (error) {
      console.error(`Error reading connector tokens for ${connectorId}:`, error);
      return null;
    }
  }

  /**
   * Elimina tokens OAuth de un connector
   */
  async deleteConnectorTokens(tenantId: string, connectorId: string): Promise<boolean> {
    try {
      const filePath = path.join(this.storagePath, tenantId, `connector_${connectorId}.json`);

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }

      return true;
    } catch (error) {
      console.error(`Error deleting connector tokens for ${connectorId}:`, error);
      return false;
    }
  }
}
