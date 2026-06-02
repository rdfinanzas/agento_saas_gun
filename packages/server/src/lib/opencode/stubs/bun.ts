// Stub for @/bun - Bun-specific APIs stubbed for server environment
// The actual Bun runtime is available but some APIs are not needed

export const BunAPI = {
  // Bun's package manager APIs
  install: async () => { throw new Error("Bun.install not available in server environment") },
  link: async () => { throw new Error("Bun.link not available in server environment") },

  // Bun's build APIs
  build: async () => { throw new Error("Bun.build not available in server environment") },

  // Bun's test APIs
  test: async () => { throw new Error("Bun.test not available in server environment") },
}

export const Registry = {
  // Package registry operations
  publish: async () => { throw new Error("Registry.publish not available in server environment") },
  search: async () => [],
  get: async () => null,
}

export default BunAPI
