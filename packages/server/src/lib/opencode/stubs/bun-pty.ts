// Stub para bun-pty - No se usa para agentes, solo para CLI interactivo
export const pty = {
  spawn: async () => {
    throw new Error("PTY not available in server environment")
  },
}

export type PtyProcess = any
