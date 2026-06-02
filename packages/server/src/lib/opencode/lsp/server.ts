/**
 * LSP Server Stub
 * 
 * Language Server Protocol - Disabled for server environment
 */

export const LSPServer = {
  /**
   * Create LSP server (no-op in server environment)
   */
  create: async (options?: any) => {
    return {
      stop: () => {},
    }
  },
}
