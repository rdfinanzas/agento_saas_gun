// Stub for @/bun/registry - Bun package registry operations
// Not needed in server environment as packages are managed by AgenTo

export const BunRegistry = {
  // Get package info from registry
  getPackage: async (name: string) => {
    return {
      name,
      version: "0.0.0",
      description: "Stub package",
    }
  },

  // Search packages in registry
  search: async (query: string) => {
    return []
  },

  // Install package
  install: async (name: string, version?: string) => {
    throw new Error("Package installation not available in server environment")
  },

  // Publish package
  publish: async (packagePath: string) => {
    throw new Error("Package publishing not available in server environment")
  },
}

export default BunRegistry
