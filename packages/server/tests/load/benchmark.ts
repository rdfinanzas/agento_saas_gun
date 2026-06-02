/**
 * Load Test - Benchmark básico de performance
 *
 * Ejecutar con: bun run tests/load/benchmark.ts
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"
const CONCURRENT_REQUESTS = 10
const TOTAL_REQUESTS = 100

interface BenchmarkResult {
  total: number
  successful: number
  failed: number
  avgResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  requestsPerSecond: number
}

async function makeRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; responseTime: number; status: number }> {
  const start = Date.now()

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    const responseTime = Date.now() - start

    return {
      success: response.ok,
      responseTime,
      status: response.status,
    }
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - start,
      status: 0,
    }
  }
}

async function runBenchmark(
  name: string,
  endpoint: string,
  options: RequestInit = {},
  requests: number = TOTAL_REQUESTS
): Promise<BenchmarkResult> {
  console.log(`\n🏃 Running benchmark: ${name}`)
  console.log(`   Endpoint: ${endpoint}`)
  console.log(`   Requests: ${requests}`)
  console.log(`   Concurrency: ${CONCURRENT_REQUESTS}`)

  const results: Array<{ success: boolean; responseTime: number; status: number }> = []
  const startTime = Date.now()

  // Ejecutar en batches concurrentes
  for (let i = 0; i < requests; i += CONCURRENT_REQUESTS) {
    const batch = []

    for (let j = 0; j < CONCURRENT_REQUESTS && i + j < requests; j++) {
      batch.push(makeRequest(endpoint, options))
    }

    const batchResults = await Promise.all(batch)
    results.push(...batchResults)

    // Mostrar progreso
    process.stdout.write(`\r   Progress: ${Math.min(i + CONCURRENT_REQUESTS, requests)}/${requests}`)
  }

  const totalTime = Date.now() - startTime

  // Calcular métricas
  const responseTimes = results.map((r) => r.responseTime)
  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  const result: BenchmarkResult = {
    total: requests,
    successful,
    failed,
    avgResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
    minResponseTime: Math.min(...responseTimes),
    maxResponseTime: Math.max(...responseTimes),
    requestsPerSecond: Math.round((requests / totalTime) * 1000),
  }

  console.log(`\n\n   ✅ Successful: ${result.successful}/${result.total}`)
  console.log(`   ❌ Failed: ${result.failed}`)
  console.log(`   ⏱️  Avg Response: ${result.avgResponseTime}ms`)
  console.log(`   ⏱️  Min Response: ${result.minResponseTime}ms`)
  console.log(`   ⏱️  Max Response: ${result.maxResponseTime}ms`)
  console.log(`   🚀 Requests/sec: ${result.requestsPerSecond}`)

  return result
}

async function main() {
  console.log("=".repeat(60))
  console.log("  LOAD TEST - AgenTo Server")
  console.log("=".repeat(60))
  console.log(`\nTarget: ${BASE_URL}`)

  // Test 1: Health Check
  await runBenchmark("Health Check", "/health", {}, 50)

  // Test 2: API Health
  await runBenchmark("API Health", "/api/v1/health", {}, 50)

  // Test 3: Login (POST)
  await runBenchmark(
    "Login Attempt",
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        email: "loadtest@example.com",
        password: "LoadTestPassword123",
      }),
    },
    30 // Menos requests para login
  )

  // Test 4: 404 Response
  await runBenchmark("404 Not Found", "/api/v1/nonexistent", {}, 30)

  console.log("\n" + "=".repeat(60))
  console.log("  BENCHMARK COMPLETE")
  console.log("=".repeat(60) + "\n")
}

main().catch(console.error)
