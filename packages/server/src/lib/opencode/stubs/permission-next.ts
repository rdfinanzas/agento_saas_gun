// Stub for @/permission/next - Permission system for Next.js
// Not needed in server environment as permissions are handled by AgenTo

import { z } from "zod"

// Permission schema
export const PermissionSchema = z.object({
  read: z.boolean().default(true),
  write: z.boolean().default(false),
  delete: z.boolean().default(false),
  execute: z.boolean().default(false),
})

export type Permission = z.infer<typeof PermissionSchema>

// Permission context for requests
export interface PermissionContext {
  tenantId: string
  userId?: string
  roles?: string[]
  permissions?: Record<string, Permission>
}

// Permission manager stub
export const PermissionManager = {
  // Check if user has permission
  hasPermission: async (context: PermissionContext, resource: string, action: string): Promise<boolean> => {
    // In server environment, permissions are handled by AgenTo's auth system
    return true
  },

  // Get permissions for a user
  getPermissions: async (context: PermissionContext): Promise<Record<string, Permission>> => {
    return {}
  },

  // Grant permission
  grant: async (context: PermissionContext, resource: string, permission: Permission): Promise<void> => {
    throw new Error("Permission management not available in server environment")
  },

  // Revoke permission
  revoke: async (context: PermissionContext, resource: string): Promise<void> => {
    throw new Error("Permission management not available in server environment")
  },
}

// PermissionNext - what the agent.ts expects
export const PermissionNext = {
  check: async () => true,
  list: async () => [],
  get: async () => null,
}

export type PermissionNext = {
  check: (resource: string, action: string) => Promise<boolean>
  list: () => Promise<string[]>
  get: (id: string) => Promise<PermissionNext | null>
}

export default PermissionNext
