/**
 * Base Integration Adapter
 *
 * Interface que todos los adapters de integracion deben implementar.
 * Cada adapter encapsula la logica de comunicacion con un sistema externo
 * (Dolibarr, API generica, etc.) y expone acciones como tools para el AI agent.
 */

import { z } from "zod"

// ─── TIPOS ────────────────────────────────────────────────────

export interface IntegrationConfig {
  baseUrl: string
  credentials: Record<string, string>
  metadata?: Record<string, unknown>
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: z.ZodType<any>
  execute: (params: Record<string, unknown>) => Promise<string>
}

export interface IntegrationAdapter {
  /** Nombre del tipo de integracion (ej: "dolibarr", "generic-api") */
  readonly type: string

  /** Test de conexion - verifica que las credenciales y URL funcionen */
  testConnection(): Promise<{ success: boolean; message: string }>

  /** Devuelve las tools disponibles para este adapter */
  getTools(context: ToolContext): ToolDefinition[]

  /** Cierra conexiones / cleanup */
  dispose?(): Promise<void>
}

export interface ToolContext {
  tenantId: string
  agentId: string
  phoneNumber: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

// ─── ABSTRACT BASE ────────────────────────────────────────────

export abstract class BaseIntegrationAdapter implements IntegrationAdapter {
  abstract readonly type: string
  protected config: IntegrationConfig

  constructor(config: IntegrationConfig) {
    this.config = config
  }

  abstract testConnection(): Promise<{ success: boolean; message: string }>
  abstract getTools(context: ToolContext): ToolDefinition[]

  protected get baseUrl(): string {
    return this.config.baseUrl.replace(/\/$/, "")
  }

  protected get credentials(): Record<string, string> {
    return this.config.credentials
  }
}
