// Stubs for OpenCode utility modules
// These are internal utilities that may not exist in the copied code

// Agent-related types
export type AgentAccessType = 'read' | 'write' | 'execute'
export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed'
export type AgentType = 'primary' | 'subagent' | 'all'

// Utility types (Arrays, Objects from remeda or similar)
export const Arrays = {
  uniq: <T>(arr: T[]): T[] => Array.from(new Set(arr)),
  flatten: <T>(arr: T[][]): T[] => arr.flat(),
  groupBy: <T, K extends string | number>(
    arr: T[],
    fn: (item: T) => K
  ): Record<K, T[]> => {
    return arr.reduce((acc, item) => {
      const key = fn(item)
      if (!acc[key]) acc[key] = [] as any
      acc[key].push(item)
      return acc
    }, {} as any)
  },
}

export const Objects = {
  keys: <T extends object>(obj: T): Array<keyof T> => Object.keys(obj) as Array<keyof T>,
  values: <T extends object>(obj: T): Array<T[keyof T]> => Object.values(obj) as any,
  entries: <T extends object>(obj: T): Array<[keyof T, T[keyof T]]> =>
    Object.entries(obj) as any,
  fromEntries: <K extends string | number | symbol, V>(
    entries: Array<[K, V]>
  ): Record<K, V> => Object.fromEntries(entries) as any,
}

// Bun process stub
export interface BunProc {
  pid: number
  killed: boolean
  kill(signal?: number): boolean
  stdout: ReadableStream
  stderr: ReadableStream
  stdin: WritableStream
  exited: Promise<number | null>
}

// File watcher stub
export interface FileWatcher {
  close(): void
  ref(): void
  unref(): void
}

// Service map (dependency injection pattern)
export interface ServiceMap {
  get<T>(key: string | symbol): T
  has(key: string | symbol): boolean
  set<T>(key: string | symbol, value: T): void
  delete(key: string | symbol): void
  clear(): void
  keys(): IterableIterator<string | symbol>
  values(): IterableIterator<any>
  entries(): IterableIterator<[string | symbol, any]>
}

// Top-level type
export type Top<T> = T extends infer U ? { [K in keyof U]: U[K] } : never

// Opaque type (for branding)
export type Opaque<T, Brand> = T & { readonly __opaque__: Brand }

// Package registry
export interface PackageRegistry {
  get(name: string): any
  has(name: string): boolean
  set(name: string, value: any): void
  list(): string[]
}

// Result type (for error handling)
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

// createInterface (readline-like)
export function createInterface(options: {
  input: NodeJS.ReadableStream
  output: NodeJS.WritableStream
}): any

// Bun core module stub
export const core = {
  serialize: (value: any): string => JSON.stringify(value),
  deserialize: <T = any>(str: string): T => JSON.parse(str),
}
