/**
 * OpenCode Tools Tests
 *
 * Tests para las herramientas BASE y del SISTEMA
 * - read_file, write_file, edit_file
 * - bash, glob, grep
 * - http_request, db_query, etc.
 */

import { describe, it, expect, beforeEach, mock } from "bun:test"
import { read_file } from "@/lib/opencode/tools/read-file"
import { write_file } from "@/lib/opencode/tools/write-file"
import { bash } from "@/lib/opencode/tools/bash"
import { glob } from "@/lib/opencode/tools/glob"
import { executeHttpRequest } from "@/lib/opencode/tools/http-request"
import { executeDbQuery } from "@/lib/opencode/tools/db-query"

const path = require("path")

// ============================================
// Mock File System
// ============================================
const mockFileSystem = new Map<string, string>()
const mockDirectories = new Set<string>()

mock.module("fs/promises", () => ({
  readFile: async (filePath: string) => {
    const normalized = path.resolve(filePath)
    if (mockFileSystem.has(normalized)) {
      return mockFileSystem.get(normalized)
    }
    throw new Error("ENOENT: file not found")
  },
  writeFile: async (filePath: string, content: string) => {
    const normalized = path.resolve(filePath)
    mockFileSystem.set(normalized, content)
  },
  mkdir: async (dirPath: string, options: any) => {
    const normalized = path.resolve(dirPath)
    if (options?.recursive) {
      const parts = normalized.split(path.sep).filter(Boolean)
      for (let i = 1; i <= parts.length; i++) {
        const dir = path.sep + parts.slice(0, i).join(path.sep)
        mockDirectories.add(dir)
      }
    }
    mockDirectories.add(normalized)
  },
  stat: async (filePath: string) => {
    const normalized = path.resolve(filePath)
    if (mockFileSystem.has(normalized)) {
      return { isFile: () => true, isDirectory: () => false, size: 100 }
    }
    if (mockDirectories.has(normalized)) {
      return { isFile: () => false, isDirectory: () => true, size: 0 }
    }
    throw new Error("ENOENT: file not found")
  },
  access: async (filePath: string) => {
    const normalized = path.resolve(filePath)
    if (!mockFileSystem.has(normalized) && !mockDirectories.has(normalized)) {
      throw new Error("ENOENT: file not found")
    }
  },
}))

// Mock createReadStream for simple files
mock.module("fs", () => ({
  createReadStream: (filePath: string) => ({
    on: (event: string, callback: any) => {
      if (event === 'data') {
        // Simulate file reading
        if (mockFileSystem.has(filePath)) {
          callback(mockFileSystem.get(filePath))
        }
      }
      if (event === 'end') {
        callback()
      }
      return this
    },
    destroy: () => {},
  }),
}))

// Mock createInterface
mock.module("readline", () => ({
  createInterface: (input: any) => ({
    [Symbol.asyncIterator]: async function* () {
      // Return simple lines for testing
      if (input.path && mockFileSystem.has(input.path)) {
        const content = mockFileSystem.get(input.path)
        const lines = content.split('\n')
        for (const line of lines) {
          yield line
        }
      }
    },
    close: () => {},
  }),
}))

// ============================================
// Mock Path Validator
// ============================================
mock.module("@/lib/opencode/types/tool-context", () => ({
  PathValidator: {
    resolve: (base: string, target: string) => {
      // For testing, use simple path resolution
      const path = require("path")
      return path.resolve(base, target)
    },
    validate: (workspacePath: string, targetPath: string) => {
      // Check for path traversal using relative path
      const path = require("path")
      const resolved = path.resolve(targetPath)
      const relative = path.relative(workspacePath, resolved)
      if (relative.startsWith("..")) {
        throw new Error("Access denied: path is outside workspace boundaries")
      }
    },
    relative: (base: string, target: string) => {
      const path = require("path")
      return path.relative(base, target)
    },
  },
}))

// ============================================
// Tests
// ============================================

describe("Tools - read_file", () => {
  const workspacePath = "/workspace/test"
  const context = {
    tenantId: "tenant-123",
    workspacePath,
  }

  beforeEach(() => {
    mockFileSystem.clear()
    mockDirectories.clear()
    mockDirectories.clear()
  })

  it("should read file content", async () => {
    const filePath = path.resolve(workspacePath, "hello.txt")
    mockFileSystem.set(filePath, "Hello World")

    const result = await read_file.execute({ path: "hello.txt" }, context as any)

    // The tool returns output with line numbers and metadata
    expect(result.output).toContain("Hello World")
    expect(result.success).toBe(true)
  })

  it("should throw error for file outside workspace", async () => {
    const badContext = {
      ...context,
      workspacePath: "/workspace/other",
    }

    try {
      await read_file.execute({ path: "../etc/passwd" }, badContext as any)
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.message).toContain("Access denied")
    }
  })

  it("should throw error for nonexistent file", async () => {
    try {
      await read_file.execute({ path: "nonexistent.txt" }, context as any)
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.message).toContain("File not found")
    }
  })
})

describe("Tools - write_file", () => {
  const workspacePath = "/workspace/test"
  const context = {
    tenantId: "tenant-123",
    workspacePath,
  }

  beforeEach(() => {
    mockFileSystem.clear()
    mockDirectories.clear()
  })

  it("should write file content", async () => {
    const result = await write_file.execute({
      path: "output.txt",
      content: "Hello World",
    }, context as any)

    expect(result.success).toBe(true)
    const filePath = path.resolve(workspacePath, "output.txt")
    expect(mockFileSystem.get(filePath)).toBe("Hello World")
  })

  it("should create parent directories", async () => {
    const result = await write_file.execute({
      path: "subdir/nested/file.txt",
      content: "Nested content",
    }, context as any)

    expect(result.success).toBe(true)
    expect(result.metadata?.path).toBe("subdir/nested/file.txt")
  })

  it("should overwrite existing file", async () => {
    const filePath = path.resolve(workspacePath, "existing.txt")
    mockFileSystem.set(filePath, "Old content")

    await write_file.execute({
      path: "existing.txt",
      content: "New content",
    }, context as any)

    expect(mockFileSystem.get(filePath)).toBe("New content")
  })
})

describe("Tools - bash", () => {
  const workspacePath = "/workspace/test"
  let permissionGranted = true

  const context = {
    tenantId: "tenant-123",
    workspacePath,
    askPermission: async () => ({ granted: permissionGranted }),
    metadata: () => {},
  }

  beforeEach(() => {
    permissionGranted = true
  })

  it("should execute command with permission", async () => {
    const result = await bash.execute({
      command: "echo hello",
    }, context as any)

    expect(result).toBeDefined()
    expect(result.title).toBe("echo")
    expect(result.metadata?.exitCode).toBe(0)
  })

  it("should fail without permission", async () => {
    permissionGranted = false

    try {
      await bash.execute({ command: "ls" }, context as any)
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.message).toContain("Permission denied")
    }
  })

  it("should respect timeout", async () => {
    const result = await bash.execute({
      command: "sleep 5",
      timeout: 100,
    }, context as any)

    expect(result.metadata?.timedOut).toBe(true)
  })

  it("should run in specified cwd", async () => {
    const result = await bash.execute({
      command: "pwd",
      cwd: "/tmp",
    }, context as any)

    expect(result.metadata?.cwd).toContain("/tmp")
  })
})

describe("Tools - glob", () => {
  const workspacePath = "/workspace/test"
  const context = {
    tenantId: "tenant-123",
    workspacePath,
  }

  beforeEach(() => {
    // Setup mock files
    mockFileSystem.set("/workspace/test/src/index.ts", "")
    mockFileSystem.set("/workspace/test/src/utils.ts", "")
    mockFileSystem.set("/workspace/test/src/components/Button.tsx", "")
    mockFileSystem.set("/workspace/test/README.md", "")
  })

  it("should find files by pattern", async () => {
    const result = await glob.execute({
      pattern: "**/*.ts",
    }, context as any)

    expect(result.files.length).toBeGreaterThanOrEqual(2)
    expect(result.files.some(f => f.includes("index.ts"))).toBe(true)
  })

  it("should respect cwd parameter", async () => {
    const result = await glob.execute({
      pattern: "*.ts",
      cwd: "/workspace/test/src",
    }, context as any)

    expect(result.files.length).toBeGreaterThanOrEqual(2)
  })

  it("should return file count", async () => {
    const result = await glob.execute({
      pattern: "**/*",
    }, context as any)

    expect(result.count).toBe(result.files.length)
  })
})

describe("Tools - http_request", () => {
  const mockFetch = mock((url: string, options?: any) => 
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Map([["content-type", "application/json"]]),
      json: async () => ({ success: true }),
      text: async () => "{\"success\":true}",
    } as Response)
  )

  mock.module("node-fetch", () => ({ default: mockFetch }))

  it("should make GET request", async () => {
    const result = await executeHttpRequest({
      url: "https://api.example.com/data",
      method: "GET",
    }, { tenantId: "tenant-123" })

    expect(result.status).toBe(200)
    expect(result.data).toBeDefined()
  })

  it("should make POST request with body", async () => {
    await executeHttpRequest({
      url: "https://api.example.com/data",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    }, { tenantId: "tenant-123" })

    const calls = mockFetch.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0][1]?.method).toBe("POST")
  })

  it("should handle query parameters", async () => {
    await executeHttpRequest({
      url: "https://api.example.com/search",
      method: "GET",
      query: { q: "test", limit: "10" },
    }, { tenantId: "tenant-123" })

    const calls = mockFetch.mock.calls
    expect(calls[calls.length - 1][0]).toContain("?q=test")
  })

  it("should handle errors", async () => {
    mockFetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "Not found",
      } as Response)
    )

    try {
      await executeHttpRequest({
        url: "https://api.example.com/missing",
        method: "GET",
      }, { tenantId: "tenant-123" })
    } catch (error: any) {
      expect(error.message).toContain("404")
    }
  })

  it("should respect timeout", async () => {
    mockFetch.mockImplementationOnce(() => 
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 10000)
      )
    )

    try {
      await executeHttpRequest({
        url: "https://api.example.com/slow",
        method: "GET",
        timeout: 50,
      }, { tenantId: "tenant-123" })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.message).toContain("timeout")
    }
  })
})

describe("Tools - db_query", () => {
  // Mock credential manager
  const mockCredentialManager = {
    getCredential: mock(async (id: string, tenantId: string) => {
      if (id === "valid-cred") {
        return {
          id: "valid-cred",
          name: "Test DB",
          type: "postgresql",
          host: "localhost",
          port: "5432",
          database: "test",
          username: "testuser",
          password: "testpass",
        }
      }
      return null
    }),
  }

  mock.module("@/modules/agent-ai/services/credential.service", () => ({
    credentialManager: mockCredentialManager,
  }))

  it("should reject non-SELECT queries", async () => {
    try {
      await executeDbQuery({
        credentialId: "valid-cred",
        query: "DELETE FROM users",
      }, { tenantId: "tenant-123" })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.message).toContain("Solo se permiten queries SELECT")
    }
  })

  it("should reject invalid credential", async () => {
    try {
      await executeDbQuery({
        credentialId: "invalid-cred",
        query: "SELECT * FROM users",
      }, { tenantId: "tenant-123" })
      expect(false).toBe(true)
    } catch (error: any) {
      expect(error.message).toContain("Credencial no encontrada")
    }
  })

  it("should allow SELECT queries", async () => {
    // Mock postgres module
    mock.module("postgres", () => ({
      default: () => ({
        unsafe: async () => [{ id: 1, name: "Test" }],
        end: async () => {},
      }),
    }))

    const result = await executeDbQuery({
      credentialId: "valid-cred",
      query: "SELECT * FROM users",
    }, { tenantId: "tenant-123" })

    expect(result.rows).toBeDefined()
    expect(result.rowCount).toBeDefined()
    expect(result.executionTime).toBeGreaterThanOrEqual(0)
  })

  it("should allow WITH queries", async () => {
    mock.module("postgres", () => ({
      default: () => ({
        unsafe: async () => [{ total: 10 }],
        end: async () => {},
      }),
    }))

    const result = await executeDbQuery({
      credentialId: "valid-cred",
      query: "WITH stats AS (SELECT COUNT(*) FROM users) SELECT * FROM stats",
    }, { tenantId: "tenant-123" })

    expect(result.rows).toBeDefined()
  })
})
