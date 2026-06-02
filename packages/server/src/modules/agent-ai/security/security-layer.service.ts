/**
 * Security Layer Service - ÚNICA fuente de verdad para permisos
 *
 * Define los modos de ejecución y las tools permitidas/bloqueadas.
 * - FULL: Acceso completo a todas las herramientas
 * - LIMITED: Solo herramientas de lectura y consulta (agentes WhatsApp)
 */

export enum ExecutionMode {
  FULL = 'FULL',
  LIMITED = 'LIMITED'
}

// ============================================
// Tools por Modo - ÚNICA FUENTE DE VERDAD
// ============================================

export const FULL_MODE_ALLOWED_TOOLS = [
  'bash',
  'read',
  'write',
  'edit',
  'glob',
  'grep',
  'list',
  'webfetch',
  'websearch',
  'execute_code',
  'browse_web',
  'api_call',
  'knowledge_query',
  'excel_read',
  'excel_write',
  'sheets_read',
  'sheets_write',
  'integration_read',
  'integration_write',
  'data_lookup',
  'file_delete',
];

export const LIMITED_MODE_ALLOWED_TOOLS = [
  'read',
  'glob',
  'grep',
  'list',
  'knowledge_query',
  'excel_read',
  'sheets_read',
  'integration_read',
  'data_lookup',
];

export const LIMITED_MODE_BLOCKED_TOOLS = [
  'bash',
  'write',
  'edit',
  'execute_code',
  'browse_web',
  'api_call',
  'webfetch',
  'websearch',
  'excel_write',
  'sheets_write',
  'integration_write',
  'file_delete',
];

// ============================================
// Comandos Peligrosos
// ============================================

const DANGEROUS_COMMANDS = [
  /rm\s+-rf/i,
  /rm\s+-fr/i,
  /del\s+\/[fs]/i,
  /format\s+[a-z]:/i,
  /mkfs/i,
  /dd\s+if=/i,
  />\s*\/dev\/sd/i,
  /chmod\s+777/i,
  /chown\s+root/i,
  /sudo\s+rm/i,
  /shutdown/i,
  /reboot/i,
  /init\s+0/i,
  /halt/i,
  /poweroff/i,
];

const DANGEROUS_PATHS = [
  /^\/etc\//i,
  /^\/root\//i,
  /^\/proc\//i,
  /^\/sys\//i,
  /^\/dev\//i,
  /^\/boot\//i,
  /^[A-Z]:\\Windows/i,
  /^[A-Z]:\\Program Files/i,
  /^[A-Z]:\\Users\\[^\\]+\\AppData/i,
];

// ============================================
// Servicio Principal
// ============================================

export class SecurityLayerService {
  /**
   * Valida si un comando es permitido según el modo
   */
  validateCommand(command: string, mode: ExecutionMode): {
    allowed: boolean;
    reason?: string;
  } {
    // Siempre bloquear comandos peligrosos
    for (const pattern of DANGEROUS_COMMANDS) {
      if (pattern.test(command)) {
        return {
          allowed: false,
          reason: `Comando bloqueado por seguridad: contiene patrón peligroso`,
        };
      }
    }

    // En modo FULL, permitir (excepto comandos peligrosos ya validados arriba)
    if (mode === ExecutionMode.FULL) {
      return { allowed: true };
    }

    // En modo LIMITED, solo permitir comandos de lectura
    const allowedPatterns = [
      /^cat\s/i,
      /^head\s/i,
      /^tail\s/i,
      /^ls\s*$/i,
      /^ls\s/i,
      /^find\s/i,
      /^grep\s/i,
      /^wc\s/i,
      /^file\s/i,
    ];

    const isAllowed = allowedPatterns.some(pattern => pattern.test(command));

    return {
      allowed: isAllowed,
      reason: isAllowed ? undefined : 'Comando no permitido en modo LIMITED',
    };
  }

  /**
   * Valida si una tool es permitida según el modo
   */
  validateTool(toolName: string, mode: ExecutionMode, additionalAllowedTools?: string[]): {
    allowed: boolean;
    reason?: string;
  } {
    if (mode === ExecutionMode.FULL) {
      // En modo FULL, todas las tools permitidas
      return { allowed: true };
    }

    // Verificar herramientas adicionales (skills dinámicos)
    if (additionalAllowedTools && additionalAllowedTools.includes(toolName)) {
      return { allowed: true };
    }

    // En modo LIMITED, verificar lista
    if (LIMITED_MODE_ALLOWED_TOOLS.includes(toolName)) {
      return { allowed: true };
    }

    if (LIMITED_MODE_BLOCKED_TOOLS.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' no está disponible en modo LIMITED`,
      };
    }

    // Por defecto, bloquear en LIMITED
    return {
      allowed: false,
      reason: `Tool '${toolName}' requiere modo FULL`,
    };
  }

  /**
   * Valida si un path es seguro
   */
  validatePath(tenantId: string, filePath: string): {
    allowed: boolean;
    reason?: string;
    sanitizedPath?: string;
  } {
    // Verificar paths peligrosos
    for (const pattern of DANGEROUS_PATHS) {
      if (pattern.test(filePath)) {
        return {
          allowed: false,
          reason: 'Path no permitido por seguridad',
        };
      }
    }

    // Verificar path traversal
    if (filePath.includes('..') || filePath.includes('~')) {
      return {
        allowed: false,
        reason: 'Path no puede contener .. o ~',
      };
    }

    // Sanitizar y construir path seguro
    const cleanPath = filePath
      .replace(/\.\./g, '')
      .replace(/^\/+/, '')
      .replace(/\\/g, '/');

    const sanitizedPath = `/storage/tenants/${tenantId}/workspace/${cleanPath}`;

    return {
      allowed: true,
      sanitizedPath,
    };
  }

  /**
   * Sanitiza un path para un tenant específico
   */
  sanitizePath(tenantId: string, filePath: string): string {
    const cleanPath = filePath
      .replace(/\.\./g, '')
      .replace(/^\/+/, '')
      .replace(/\\/g, '/');
    return `/storage/tenants/${tenantId}/workspace/${cleanPath}`;
  }

  /**
   * Obtiene las tools permitidas para un modo
   */
  getAllowedTools(mode: ExecutionMode): string[] {
    if (mode === ExecutionMode.FULL) {
      return FULL_MODE_ALLOWED_TOOLS;
    }
    return LIMITED_MODE_ALLOWED_TOOLS;
  }

  /**
   * Obtiene las tools bloqueadas para un modo
   */
  getBlockedTools(mode: ExecutionMode): string[] {
    if (mode === ExecutionMode.FULL) {
      return [];
    }
    return LIMITED_MODE_BLOCKED_TOOLS;
  }

  /**
   * Verifica si una operación requiere aprobación humana
   */
  requiresHumanApproval(
    operation: string,
    mode: ExecutionMode,
    confidence?: number
  ): boolean {
    // En modo LIMITED, requerir aprobación si la confianza es baja
    if (mode === ExecutionMode.LIMITED && confidence !== undefined && confidence < 0.7) {
      return true;
    }

    // Ciertas operaciones siempre requieren aprobación
    const sensitiveOperations = [
      'delete_file',
      'send_payment',
      'modify_settings',
      'access_sensitive_data',
    ];

    return sensitiveOperations.includes(operation);
  }
}

// Exportar instancia singleton
export const securityLayer = new SecurityLayerService();
