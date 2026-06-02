/**
 * Tool Permission System
 * 
 * SP-4.6: Sistema de permisos para tools
 * 
 * Features:
 * - Define qué tools requieren aprobación
 * - Permisos por tenant
 * - Permisos por tool específica
 * - Blacklist/whitelist
 */

import { systemTools } from "./index"

// Tools que SIEMPRE requieren aprobación (independientemente de la configuración)
const ALWAYS_REQUIRE_APPROVAL = [
  "http_request",
  "db_query", 
  "schedule_task",
  "whatsapp_send",
  "bash",
  "write_file",
  "edit_file",
]

// Tools que NUNCA requieren aprobación (lectura segura)
const NEVER_REQUIRE_APPROVAL = [
  "read_file",
  "read_url",
  "glob",
  "grep",
  "ls",
]

export interface PermissionConfig {
  // Modo global: "ask" = siempre preguntar, "allow" = permitir todo, "deny" = denegar todo
  defaultMode: "ask" | "allow" | "deny"
  
  // Reglas específicas por tool
  toolRules: Record<string, {
    mode: "ask" | "allow" | "deny"
    // Patrones que siempre requieren aprobación (ej: bash "rm -rf")
    dangerousPatterns?: string[]
    // Patrones que siempre se permiten (ej: bash "ls")
    safePatterns?: string[]
  }>
  
  // Herramientas del usuario permitidas/bloqueadas
  userToolRules: {
    allowed: string[] // whitelist
    blocked: string[] // blacklist
    defaultMode: "ask" | "allow" | "deny"
  }
}

/**
 * Configuración por defecto
 */
export const defaultPermissionConfig: PermissionConfig = {
  defaultMode: "ask",
  toolRules: {
    bash: {
      mode: "ask",
      dangerousPatterns: [
        "rm -rf",
        "rm -r /",
        "dd if=",
        "> /dev/",
        "mkfs",
        "format",
        "del /f",
        "rd /s",
      ],
      safePatterns: [
        "^ls",
        "^cat",
        "^echo",
        "^pwd",
        "^whoami",
        "^npm install",
        "^npm run",
        "^git status",
        "^git log",
        "^git diff",
      ],
    },
    http_request: {
      mode: "ask",
      dangerousPatterns: [
        "DELETE",
        "PUT",
        "PATCH",
      ],
      safePatterns: [
        "GET https://api.",
      ],
    },
    db_query: {
      mode: "ask",
      dangerousPatterns: [
        "INSERT",
        "UPDATE",
        "DELETE",
        "DROP",
        "CREATE",
        "ALTER",
      ],
    },
  },
  userToolRules: {
    allowed: [],
    blocked: [],
    defaultMode: "ask",
  },
}

/**
 * Verifica si una tool requiere aprobación
 */
export function requiresApproval(
  toolName: string,
  params: any,
  config: PermissionConfig = defaultPermissionConfig
): { requiresApproval: boolean; reason?: string } {
  // 1. Verificar lista de tools que siempre requieren aprobación
  if (ALWAYS_REQUIRE_APPROVAL.includes(toolName)) {
    // Pero verificar si hay patrón seguro que lo anule
    const toolRule = config.toolRules[toolName]
    if (toolRule?.safePatterns && params) {
      const paramString = JSON.stringify(params).toLowerCase()
      for (const pattern of toolRule.safePatterns) {
        const regex = new RegExp(pattern, "i")
        if (regex.test(paramString)) {
          return { requiresApproval: false, reason: "Safe pattern matched" }
        }
      }
    }
    return { requiresApproval: true, reason: "Tool requires approval" }
  }

  // 2. Verificar lista de tools que nunca requieren aprobación
  if (NEVER_REQUIRE_APPROVAL.includes(toolName)) {
    return { requiresApproval: false }
  }

  // 3. Verificar reglas específicas de la tool
  const toolRule = config.toolRules[toolName]
  if (toolRule) {
    // Verificar patrones peligrosos primero
    if (toolRule.dangerousPatterns && params) {
      const paramString = JSON.stringify(params).toLowerCase()
      for (const pattern of toolRule.dangerousPatterns) {
        if (paramString.includes(pattern.toLowerCase())) {
          return { 
            requiresApproval: true, 
            reason: `Dangerous pattern detected: ${pattern}` 
          }
        }
      }
    }

    // Verificar modo de la regla
    if (toolRule.mode === "allow") {
      return { requiresApproval: false, reason: "Tool allowed by rule" }
    }
    if (toolRule.mode === "deny") {
      return { requiresApproval: true, reason: "Tool blocked by rule" }
    }
  }

  // 4. Verificar modo por defecto
  if (config.defaultMode === "allow") {
    return { requiresApproval: false, reason: "Default mode: allow" }
  }
  if (config.defaultMode === "deny") {
    return { requiresApproval: true, reason: "Default mode: deny" }
  }

  // 5. Por defecto, requerir aprobación
  return { requiresApproval: true, reason: "Default: ask" }
}

/**
 * Verifica si una herramienta de usuario está permitida
 */
export function isUserToolAllowed(
  toolName: string,
  config: PermissionConfig = defaultPermissionConfig
): { allowed: boolean; reason?: string } {
  const rules = config.userToolRules

  // Verificar blacklist primero
  if (rules.blocked.includes(toolName)) {
    return { allowed: false, reason: "Tool blocked by blacklist" }
  }

  // Verificar whitelist (si no está vacía)
  if (rules.allowed.length > 0 && !rules.allowed.includes(toolName)) {
    return { allowed: false, reason: "Tool not in whitelist" }
  }

  // Verificar modo por defecto
  if (rules.defaultMode === "deny") {
    return { allowed: false, reason: "User tools denied by default" }
  }

  return { allowed: true }
}

/**
 * Crea una configuración de permisos personalizada para un tenant
 */
export function createTenantPermissionConfig(
  overrides: Partial<PermissionConfig>
): PermissionConfig {
  return {
    ...defaultPermissionConfig,
    ...overrides,
    toolRules: {
      ...defaultPermissionConfig.toolRules,
      ...overrides.toolRules,
    },
    userToolRules: {
      ...defaultPermissionConfig.userToolRules,
      ...overrides.userToolRules,
    },
  }
}

export const permissionSystem = {
  requiresApproval,
  isUserToolAllowed,
  createTenantPermissionConfig,
  defaultPermissionConfig,
  ALWAYS_REQUIRE_APPROVAL,
  NEVER_REQUIRE_APPROVAL,
}
