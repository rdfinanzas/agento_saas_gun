/**
 * Redis Mock - Mock para Redis y BullMQ
 */

import { mock } from "bun:test"

// Mock jobs store
const mockJobs = new Map<string, any[]>()
const mockQueues = new Map<string, any>()

export class MockRedis {
  private store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null
  }

  async set(key: string, value: string, ...args: any[]): Promise<void> {
    this.store.set(key, value)
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace("*", ".*"))
    return Array.from(this.store.keys()).filter(k => regex.test(k))
  }

  async expire(key: string, seconds: number): Promise<void> {}

  async ping(): Promise<string> {
    return "PONG"
  }

  // Queue operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    const list = mockJobs.get(key) || []
    list.unshift(...values)
    mockJobs.set(key, list)
    return list.length
  }

  async rpop(key: string): Promise<string | null> {
    const list = mockJobs.get(key) || []
    const value = list.pop()
    mockJobs.set(key, list)
    return value || null
  }

  async blpop(...args: any[]): Promise<[string, string] | null> {
    return null
  }
}

export const mockRedis = new MockRedis()

// Mock BullMQ
export class MockQueue {
  name: string

  constructor(name: string) {
    this.name = name
    mockQueues.set(name, this)
  }

  async add(name: string, data: any, opts?: any): Promise<any> {
    const job = {
      id: crypto.randomUUID(),
      name,
      data,
      opts,
      attemptsMade: 0,
      progress: () => Promise.resolve(),
      moveToCompleted: () => Promise.resolve(),
      moveToFailed: () => Promise.resolve(),
    }
    
    const jobs = mockJobs.get(this.name) || []
    jobs.push(job)
    mockJobs.set(this.name, jobs)
    
    return job
  }

  async getJob(id: string): Promise<any> {
    const jobs = mockJobs.get(this.name) || []
    return jobs.find(j => j.id === id)
  }

  async getJobs(types: string[], start = 0, end = -1): Promise<any[]> {
    return mockJobs.get(this.name) || []
  }

  async pause(): Promise<void> {}
  async resume(): Promise<void> {}
  async close(): Promise<void> {}
}

export class MockWorker {
  name: string
  running = false

  constructor(
    name: string,
    processor: (job: any) => Promise<any>,
    opts?: any
  ) {
    this.name = name
  }

  on(event: string, handler: Function): void {}
  async close(): Promise<void> {
    this.running = false
  }
  async run(): Promise<void> {
    this.running = true
  }
}

// Helper functions
export function clearMockJobs() {
  mockJobs.clear()
  mockQueues.clear()
}

export function getMockJobs(queueName: string): any[] {
  return mockJobs.get(queueName) || []
}
