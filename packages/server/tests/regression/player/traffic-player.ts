// Traffic Player - Reproduces recorded requests against Bun backend
import { readFileSync, readdirSync, existsSync } from "fs"
import { join } from "path"
import { RecordedRequest } from "../recorder/traffic-recorder"

export interface ReplayResult {
  requestId: string
  flowName: string
  path: string
  method: string
  nodeStatus: number
  bunStatus: number
  nodeBody: any
  bunBody: any
  match: boolean
  differences: string[]
  responseTime: number
}

export class TrafficPlayer {
  private baseUrl: string
  private fixturePath: string

  constructor(
    baseUrl: string = process.env.BUN_BACKEND_URL || "http://localhost:3001",
    fixturePath: string = "./tests/regression/fixtures"
  ) {
    this.baseUrl = baseUrl
    this.fixturePath = fixturePath
  }

  /**
   * Replay a single request against the new backend
   */
  async replayRequest(request: RecordedRequest, flowName: string): Promise<ReplayResult> {
    const startTime = Date.now()

    try {
      // Prepare headers
      const headers: Record<string, string> = {
        ...request.headers,
        host: new URL(this.baseUrl).host,
      }

      // Make the request to Bun backend
      const response = await fetch(`${this.baseUrl}${request.path}?${new URLSearchParams(request.query)}`, {
        method: request.method,
        headers,
        body: request.body,
      })

      const responseTime = Date.now() - startTime
      const bunBody = await response.text()

      // Compare responses
      const differences = this.compareResponses(request.response, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: bunBody,
      })

      return {
        requestId: request.id,
        flowName,
        path: request.path,
        method: request.method,
        nodeStatus: request.response.status,
        bunStatus: response.status,
        nodeBody: this.tryParseJson(request.response.body),
        bunBody: this.tryParseJson(bunBody),
        match: differences.length === 0,
        differences,
        responseTime,
      }
    } catch (error) {
      return {
        requestId: request.id,
        flowName,
        path: request.path,
        method: request.method,
        nodeStatus: request.response.status,
        bunStatus: 0,
        nodeBody: this.tryParseJson(request.response.body),
        bunBody: null,
        match: false,
        differences: [`Request failed: ${error}`],
        responseTime: Date.now() - startTime,
      }
    }
  }

  /**
   * Compare two responses
   */
  private compareResponses(
    expected: { status: number; body: string; headers: Record<string, string> },
    actual: { status: number; body: string; headers: Record<string, string> }
  ): string[] {
    const differences: string[] = []

    // Compare status codes
    if (expected.status !== actual.status) {
      differences.push(`Status code mismatch: ${expected.status} vs ${actual.status}`)
    }

    // Compare body
    const expectedJson = this.tryParseJson(expected.body)
    const actualJson = this.tryParseJson(actual.body)

    if (expectedJson && actualJson) {
      differences.push(...this.compareJsonBodies(expectedJson, actualJson))
    } else if (expected.body !== actual.body) {
      differences.push("Body content differs")
    }

    return differences
  }

  /**
   * Compare JSON bodies with semantic understanding
   */
  private compareJsonBodies(expected: any, actual: any, path = ""): string[] {
    const differences: string[] = []

    // Fields to ignore in comparison
    const ignoreFields = ["createdAt", "updatedAt", "id", "token", "sessionId", "timestamp", "time"]

    if (typeof expected !== typeof actual) {
      differences.push(`${path || "root"}: type mismatch`)
      return differences
    }

    if (typeof expected !== "object" || expected === null) {
      if (expected !== actual) {
        differences.push(`${path || "root"}: value mismatch`)
      }
      return differences
    }

    // Compare objects
    const allKeys = new Set([...Object.keys(expected || {}), ...Object.keys(actual || {})])

    for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key

    if (ignoreFields.includes(key)) continue

    const expectedValue = expected?.[key]
    const actualValue = actual?.[key]

    if (!(key in (expected || {}))) {
      // Skip if field is missing in expected but present in actual
      continue
    }

    if (!(key in (actual || {}))) {
      differences.push(`${currentPath}: missing in response`)
      continue
    }

    if (typeof expectedValue === "object" && expectedValue !== null) {
      differences.push(...this.compareJsonBodies(expectedValue, actualValue, currentPath))
    } else if (expectedValue !== actualValue) {
      differences.push(`${currentPath}: ${expectedValue} vs ${actualValue}`)
    }
  }

  return differences
  }

  /**
   * Try to parse JSON, */
  private tryParseJson(body: string): any | null {
    try {
      return JSON.parse(body)
    } catch {
      return null
    }
  }

  /**
   * Replay all fixtures
   */
  async replayAllFixtures(): Promise<ReplayResult[]> {
    const results: ReplayResult[] = []

    if (!existsSync(this.fixturePath)) {
      console.error(`Fixture path not found: ${this.fixturePath}`)
      return results
    }

    const files = readdirSync(this.fixturePath).filter((f) => f.endsWith(".json"))
    console.log(`\n🔄 Replaying ${files.length} fixtures against ${this.baseUrl}\n`)

    for (const file of files) {
      const flowName = file.replace(".json", "")
      const requests: RecordedRequest[] = JSON.parse(
        readFileSync(join(this.fixturePath, file), "utf-8")
      )

      console.log(`📋 Processing ${flowName} (${requests.length} requests)...`)

      for (const request of requests) {
        const result = await this.replayRequest(request, flowName)
        results.push(result)

        const icon = result.match ? "✅" : "❌"
        console.log(`  ${icon} ${result.method} ${result.path}`)

        if (!result.match) {
          result.differences.forEach((d) => console.log(`     - ${d}`))
        }
      }
    }

    return results
  }
}

// Helper function to create player instance
export function createPlayer(
  baseUrl?: string,
  fixturePath?: string
): TrafficPlayer {
  return new TrafficPlayer(baseUrl, fixturePath)
}
