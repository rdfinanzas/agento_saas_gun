// Stubs for missing exports from ai package
// These are types/functions that exist in older versions or are OpenCode-specific

import type { CoreMessage } from 'ai'

// Re-export CoreMessage as ModelMessage for compatibility
export type ModelMessage = CoreMessage

// Tool-related types
export interface ToolCallOptions {
  onCancel?: () => void
}

// Language Model V2 types (OpenCode-specific)
export interface LanguageModelV2Content {
  type: 'text' | 'image' | 'tool-call' | 'tool-result'
  content?: string
  toolName?: string
  toolArgs?: string
  result?: string
}

// Dynamic tool creation (OpenCode-specific)
export function dynamicTool<T extends Record<string, any>>(config: {
  description: string
  parameters: {
    schema: Record<string, any>
    type: 'object'
  }
  execute: (args: T) => Promise<string | Record<string, any>>
}): any

// Tool execution
export async function executeTool<T = any>(toolCall: {
  toolName: string
  toolArgs?: T
}): Promise<any>

// Provider-related types
export interface SharedV2ProviderMetadata {
  [key: string]: any
}

// Tool set type
export type ToolSet = Record<string, any>

// Provider options parsing
export function parseProviderOptions(options: any): any

// Provider-defined tool factories
export function createProviderDefinedToolFactory(config: any): any
export function createProviderDefinedToolFactoryWithOutputSchema(config: any): any

// Utility functions
export function convertToBase64(data: string | Buffer): string
export function withUserAgentSuffix(userAgent: string): string
