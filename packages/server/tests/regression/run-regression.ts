// Run regression testing - Compare Node.js vs Bun responses
// Usage: bun run tests/regression/run-regression.ts

import { createPlayer, ReplayResult } from "./player/traffic-player"
import { writeFileSync } from "fs"

interface RegressionReport {
  timestamp: string
  summary: {
    total: number
    passed: number
    failed: number
    warnings: number
    averageResponseTime: number
  }
  results: ReplayResult[]
  failedEndpoints: {
    path: string
    method: string
    differences: string[]
  }[]
}

function generateReport(results: ReplayResult[]): RegressionReport {
  const passed = results.filter((r) => r.match).length
  const failed = results.filter((r) => !r.match).length
  const totalResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0)

  return {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
    warnings: 0,
      averageResponseTime: Math.round(totalResponseTime / results.length),
    },
    results,
    failedEndpoints: results
      .filter((r) => !r.match)
      .map((r) => ({
        path: r.path,
        method: r.method,
        differences: r.differences,
      })),
  }
}

function printReport(report: RegressionReport) {
  console.log("\n" + "=".repeat(60))
  console.log("📊 REGRESSION TEST REPORT")
  console.log("=".repeat(60))

  const { summary, failedEndpoints } = report

  console.log(`\n📈 Summary:`)
  console.log(`   Total requests:  ${summary.total}`)
  console.log(`   ✅ Passed:       ${summary.passed} (${((summary.passed / summary.total) * 100).toFixed(1)}%)`)
  console.log(`   ❌ Failed:       ${summary.failed} (${((summary.failed / summary.total) * 100).toFixed(1)}%)`)
  console.log(`   ⏱️  Avg time:    ${summary.averageResponseTime}ms`)

  if (failedEndpoints.length > 0) {
    console.log(`\n❌ Failed Endpoints (${failedEndpoints.length}):`)
    console.log("-".repeat(60))

    for (const endpoint of failedEndpoints) {
      console.log(`\n  ${endpoint.method} ${endpoint.path}`)
      for (const diff of endpoint.differences) {
        console.log(`    - ${diff}`)
      }
    }
  }

  console.log("\n" + "=".repeat(60))
}

async function runRegression() {
  console.log("🚀 Starting regression testing...")
  console.log(`Bun Backend: ${process.env.BUN_BACKEND_URL || "http://localhost:3001"}\n`)

  const player = createPlayer()
  const results = await player.replayAllFixtures()

  const report = generateReport(results)
  printReport(report)

  // Save report to file
  const reportPath = "./tests/regression/regression-report.json"
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n📄 Report saved to: ${reportPath}`)

  // Exit with error code if any tests failed
  if (report.summary.failed > 0) {
    console.log("\n❌ Regression tests FAILED")
    process.exit(1)
  }

  console.log("\n✅ All regression tests PASSED")
  process.exit(0)
}

runRegression().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
