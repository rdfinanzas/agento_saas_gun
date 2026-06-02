// Traffic Recorder - Graba requests del frontend contra el backend Node.js
import { chromium, Browser, Page, BrowserContext, Request as PlaywrightRequest, Route } from "playwright"
import { writeFileSync, existsSync, mkdirSync, readdirSync } from "fs"
import { join, basename } from "path"

export interface RecordedRequest {
  id: string
  timestamp: string
  method: string
  url: string
  path: string
  query: Record<string, string>
  headers: Record<string, string>
  body?: string
  response: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
  }
}

export class TrafficRecorder {
  private requests: RecordedRequest[] = []
  private outputPath: string
  private baseUrl: string

  constructor(
    outputDir: string = "./tests/regression/fixtures",
    baseUrl: string = process.env.NODE_BACKEND_URL || "http://localhost:3000"
  ) {
    this.outputPath = outputDir
    this.baseUrl = baseUrl

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }
  }

  /**
   * Create a browser context that intercepts and records all API requests
   */
  async createRecordingContext(): Promise<{ browser: Browser; context: BrowserContext }> {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      baseURL: this.baseUrl,
      // Ignore HTTPS errors for local testing
      ignoreHTTPSErrors: true,
    })

    // Intercept all API requests
    await context.route("**/api/**", async (route: Route, request: PlaywrightRequest) => {
    const startTime = Date.now()

    try {
      // Continue with the actual request to capture real response
      const response = await route.fetch()

      const recordedRequest: RecordedRequest = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: request.url(),
        path: new URL(request.url()).pathname,
        query: Object.fromEntries(new URL(request.url()).searchParams),
        headers: this.sanitizeHeaders(request.headers()),
        body: request.postData() || undefined,
        response: {
          status: response.status(),
          statusText: response.statusText(),
          headers: this.sanitizeHeaders(response.headers()),
          body: await response.text(),
        },
      }

      this.requests.push(recordedRequest)

      console.log(`  📹 ${recordedRequest.method} ${recordedRequest.path} → ${response.status()}`)

      // Fulfill with the original response
      await route.fulfill({ response })
    } catch (error) {
      console.error(`  ❌ Error recording request: ${request.url()}`)
      await route.abort()
    }
  })

    return { browser, context }
  }

  /**
   * Execute a user flow and record all requests
   */
  async recordFlow(flowName: string, flowFn: (page: Page) => Promise<void>): Promise<RecordedRequest[]> {
    console.log(`\n🎬 Recording flow: ${flowName}`)

    this.requests = [] // Reset for new flow

    const { browser, context } = await this.createRecordingContext()
    const page = await context.newPage()

    try {
    await flowFn(page)
    await page.waitForTimeout(1000) // Wait for any pending requests
  } catch (error) {
    console.error(`  ❌ Flow failed: ${error}`)
  } finally {
    await browser.close()
  }

  // Save recorded requests
  const filename = join(this.outputPath, `${flowName}.json`)
  writeFileSync(filename, JSON.stringify(this.requests, null, 2))
  console.log(`  ✅ Saved ${this.requests.length} requests to ${filename}`)

  return this.requests
  }

  /**
   * Get all recorded fixtures
   */
  getFixtures(): string[] {
    if (!existsSync(this.outputPath)) return []
    return readdirSync(this.outputPath)
      .filter((f) => f.endsWith(".json"))
      .map((f) => basename(f, ".json"))
  }

  /**
   * Load a specific fixture
   */
  loadFixture(flowName: string): RecordedRequest[] {
    const filename = join(this.outputPath, `${flowName}.json`)
    if (!existsSync(filename)) {
      throw new Error(`Fixture not found: ${flowName}`)
    }
    return JSON.parse(require("fs").readFileSync(filename, "utf-8"))
  }

  /**
   * Sanitize headers to remove sensitive or dynamic values
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {}
    const ignoreHeaders = ["cookie", "set-cookie", "authorization", "user-agent", "date"]

    for (const [key, value] of Object.entries(headers)) {
    if (ignoreHeaders.includes(key.toLowerCase())) continue
    sanitized[key] = value
  }

  return sanitized
  }
}

// Helper function to create recorder instance
export function createRecorder(
  outputDir?: string,
  baseUrl?: string
): TrafficRecorder {
  return new TrafficRecorder(outputDir, baseUrl)
}
