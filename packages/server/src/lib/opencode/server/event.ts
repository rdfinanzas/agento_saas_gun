/**
 * Server Event Stub
 * 
 * Server events - Disabled for server environment
 */

export const Event = {
  ServerStarted: {
    define: (schema: any) => ({ name: "server.started", schema }),
  },
  ServerStopped: {
    define: (schema: any) => ({ name: "server.stopped", schema }),
  },
}
