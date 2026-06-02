/**
 * Test Server Helper - Servidor de prueba para tests E2E
 */

import { spawn, Subprocess } from "bun"

export interface TestServerOptions {
  port?: number
  timeout?: number
}

export class TestServer {
  private server: Subprocess | null = null
  private port: number
  private timeout: number

  constructor(options: TestServerOptions = {}) {
    this.port = options.port || 3099
    this.timeout = options.timeout || 10000
  }

  /**
   * Inicia el servidor de prueba
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error("Server already running")
    }

    console.log(`Starting test server on port ${this.port}...`)

    this.server = spawn({
      cmd: ["bun", "run", "src/index.ts"],
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(this.port),
      },
      stdout: "pipe",
      stderr: "pipe",
    })

    // Esperar a que el servidor esté listo
    await this.waitForReady()
  }

  /**
   * Espera a que el servidor esté listo
   */
  private async waitForReady(): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < this.timeout) {
      try {
        const response = await fetch(`http://localhost:${this.port}/health`)
        if (response.ok) {
          console.log(`Test server ready on port ${this.port}`)
          return
        }
      } catch {
        // Servidor no listo aún
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    throw new Error(`Test server failed to start within ${this.timeout}ms`)
  }

  /**
   * Detiene el servidor de prueba
   */
  async stop(): Promise<void> {
    if (this.server) {
      this.server.kill()
      this.server = null
      console.log("Test server stopped")
    }
  }

  /**
   * Obtiene la URL base del servidor
   */
  getBaseUrl(): string {
    return `http://localhost:${this.port}`
  }

  /**
   * Obtiene el puerto del servidor
   */
  getPort(): number {
    return this.port
  }
}

// Instancia global del servidor de prueba
let testServerInstance: TestServer | null = null

export async function getTestServer(): Promise<TestServer> {
  if (!testServerInstance) {
    testServerInstance = new TestServer()
    await testServerInstance.start()
  }
  return testServerInstance
}

export async function stopTestServer(): Promise<void> {
  if (testServerInstance) {
    await testServerInstance.stop()
    testServerInstance = null
  }
}
