/**
 * LSP Stub
 * 
 * Language Server Protocol - Disabled for server environment
 * This is a stub that provides empty implementations
 */

export const LSP = {
  /**
   * Touch a file (no-op in server environment)
   */
  touchFile: async (filepath: string, open?: boolean) => {
    // No-op in server
  },

  /**
   * Get diagnostics (empty in server environment)
   */
  diagnostics: async () => [],

  /**
   * Diagnostic helper (returns empty string in server environment)
   */
  Diagnostic: {
    pretty: () => "",
  },
}
