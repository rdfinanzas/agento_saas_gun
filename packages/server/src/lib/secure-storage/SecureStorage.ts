/**
 * SecureStorage - Almacenamiento de credenciales
 * Adaptado para multi-tenant
 * Usa almacenamiento JSON con permisos de archivo restrictivos en Docker
 */

import * as fs from "node:fs";
import * as path from "node:path";

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
  createdAt: string;
  updatedAt: string;
}

/**
 * Almacenamiento de credenciales usando JSON files
 */
export class SecureStorage {
  private storagePath: string;
  private appId: string;

  constructor(options: SecureStorageOptions) {
    this.storagePath = options.storagePath;
    this.appId = options.appId;
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  private getCredentialPath(tenantId: string, provider: string): string {
    return path.join(this.storagePath, `${tenantId}_${provider}.json`);
  }

  async storeApiKey(
    tenantId: string,
    provider: string,
    apiKey: string,
    baseUrl?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const credential: StoredCredential = {
      provider,
      apiKey,
      baseUrl,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const filePath = this.getCredentialPath(tenantId, provider);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await fs.promises.writeFile(filePath, JSON.stringify(credential, null, 2));
    console.log(`[SecureStorage] Stored API key for ${provider} (tenant: ${tenantId})`);
  }

  async getApiKey(
    tenantId: string,
    provider: string
  ): Promise<StoredCredential | null> {
    try {
      const filePath = this.getCredentialPath(tenantId, provider);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const fileContent = await fs.promises.readFile(filePath, "utf8");
      const credential: StoredCredential = JSON.parse(fileContent);

      if (!credential.apiKey) {
        return null;
      }

      return credential;
    } catch (error) {
      console.error(`[SecureStorage] Error reading credential for ${provider}:`, error);
      return null;
    }
  }

  async deleteApiKey(tenantId: string, provider: string): Promise<boolean> {
    try {
      const filePath = this.getCredentialPath(tenantId, provider);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      return true;
    } catch (error) {
      console.error(`[SecureStorage] Error deleting credential for ${provider}:`, error);
      return false;
    }
  }

  async listProviders(tenantId: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.storagePath);
      const tenantFiles = files.filter((f) => f.startsWith(`${tenantId}_`));
      return tenantFiles.map((f) => f.replace(`${tenantId}_`, "").replace(".json", ""));
    } catch (error) {
      console.error("[SecureStorage] Error listing providers:", error);
      return [];
    }
  }

  async hasApiKey(tenantId: string, provider: string): Promise<boolean> {
    const filePath = this.getCredentialPath(tenantId, provider);
    return fs.existsSync(filePath);
  }
}

let secureStorageInstance: SecureStorage | null = null;

export function getSecureStorage(): SecureStorage {
  if (!secureStorageInstance) {
    const cwd = process.cwd();
    const storagePath = process.env.SECURE_STORAGE_PATH || path.join(cwd, "storage/keys");
    console.log(`[SecureStorage] Initializing: cwd=${cwd}, storagePath=${storagePath}`);
    secureStorageInstance = new SecureStorage({
      storagePath,
      appId: "agento-saas",
    });
  }
  return secureStorageInstance;
}
