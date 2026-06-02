/**
 * Server Stub
 * 
 * Server is disabled for server environment
 * This is a stub that provides empty implementations
 */

export const Server = {
  /**
   * Start server (no-op in server environment)
   */
  start: async (options?: any) => {
    return { stop: () => {} }
  },
}
