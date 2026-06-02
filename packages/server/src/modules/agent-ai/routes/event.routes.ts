import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { Bus } from "@/lib/opencode/api-pg"

export const eventRoutes = new Hono()

eventRoutes.get("/event", async (c) => {
  const sessionId = c.req.query("sessionId")
  const tenantId = c.req.header("X-Tenant-ID") || "default"
  
  return streamSSE(c, async (stream) => {
    // Enviar evento de conexión
    await stream.writeSSE({
      data: JSON.stringify({ 
        type: "server.connected", 
        sessionId,
        timestamp: Date.now() 
      }),
    })
    
    // Suscribirse a eventos del Bus
    const unsubscribe = Bus.subscribeAll(async (event: any) => {
      // Filtrar eventos por tenant si es necesario
      if (event.tenantId && event.tenantId !== tenantId) {
        return
      }
      
      // Filtrar por sessionId si se proporcionó
      if (sessionId && event.sessionId && event.sessionId !== sessionId) {
        return
      }
      
      await stream.writeSSE({
        data: JSON.stringify(event),
      })
    })
    
    // Heartbeat cada 30 segundos
    const heartbeat = setInterval(async () => {
      await stream.writeSSE({
        data: JSON.stringify({ 
          type: "server.heartbeat", 
          timestamp: Date.now() 
        }),
      })
    }, 30000)
    
    // Cleanup al cerrar conexión
    c.req.raw.signal.addEventListener("abort", () => {
      unsubscribe()
      clearInterval(heartbeat)
    })
    
    // Mantener la conexión abierta
    while (!c.req.raw.signal.aborted) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  })
})
