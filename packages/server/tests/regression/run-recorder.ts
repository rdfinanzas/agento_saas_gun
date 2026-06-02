// Run traffic recording against Node.js backend
// Usage: bun run tests/regression/run-recorder.ts

import { createRecorder } from "./recorder/traffic-recorder"
import { allFlows } from "./recorder/record-flows"

async function runRecording() {
  console.log("🎬 Starting traffic recording...")
  console.log(`Target: ${process.env.NODE_BACKEND_URL || "http://localhost:3000"}\n`)

  const recorder = createRecorder()

  let totalRequests = 0

  for (const flow of allFlows) {
    console.log(`\n📹 Recording flow: ${flow.name}`)
    console.log(`   ${flow.description}`)

    try {
      const requests = await recorder.recordFlow(flow.name, flow.flow)
      totalRequests += requests.length
      console.log(`   ✅ Recorded ${requests.length} requests`)
    } catch (error) {
      console.error(`   ❌ Failed: ${error}`)
    }
  }

  console.log("\n" + "=".repeat(50))
  console.log(`📊 Recording Summary`)
  console.log("=".repeat(50))
  console.log(`Total flows recorded: ${allFlows.length}`)
  console.log(`Total requests captured: ${totalRequests}`)
  console.log(`\n✅ Recording complete!`)
  console.log(`Run 'bun run test:replay' to test against Bun backend`)
}

runRecording().catch(console.error)
