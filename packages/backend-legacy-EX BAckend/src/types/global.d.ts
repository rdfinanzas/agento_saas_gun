/**
 * Global type declarations for AgenTo Backend
 */

declare global {
  // Console API
  const console: {
    log: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
  };

  // Process API (minimal)
  const process: {
    env: Record<string, string | undefined>;
  };
}

export {};
