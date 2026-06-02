/**
 * CLI Resolver - Encuentra el ejecutable de OpenCode CLI
 *
 * Soporta Windows, Linux y macOS.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface CliInfo {
  path: string;
  version: string | null;
  isNpx: boolean;
  isGlobal: boolean;
}

/**
 * Resuelve la ruta al CLI de OpenCode
 */
export function resolveOpenCodeCli(): CliInfo {
  const isWindows = process.platform === 'win32';

  // 1. Intentar con npx (preferido)
  try {
    const npxPath = isWindows ? 'npx' : 'npx';
    const version = getVersionViaNpx();

    return {
      path: npxPath,
      version,
      isNpx: true,
      isGlobal: false,
    };
  } catch (error) {
    // Continuar con otras opciones
  }

  // 2. Buscar instalación global
  const globalPaths = getGlobalPaths();

  for (const globalPath of globalPaths) {
    const cliPath = isWindows
      ? path.join(globalPath, 'opencode.cmd')
      : path.join(globalPath, 'opencode');

    if (fs.existsSync(cliPath)) {
      try {
        const version = getVersionFromPath(cliPath);
        return {
          path: cliPath,
          version,
          isNpx: false,
          isGlobal: true,
        };
      } catch {
        continue;
      }
    }
  }

  // 3. Buscar en node_modules local
  const localPaths = [
    path.join(process.cwd(), 'node_modules', '.bin'),
    path.join(process.cwd(), '..', 'node_modules', '.bin'),
    path.join(process.cwd(), '..', '..', 'node_modules', '.bin'),
  ];

  for (const localPath of localPaths) {
    const cliPath = isWindows
      ? path.join(localPath, 'opencode.cmd')
      : path.join(localPath, 'opencode');

    if (fs.existsSync(cliPath)) {
      try {
        const version = getVersionFromPath(cliPath);
        return {
          path: cliPath,
          version,
          isNpx: false,
          isGlobal: false,
        };
      } catch {
        continue;
      }
    }
  }

  // Fallback a npx
  return {
    path: 'npx',
    version: null,
    isNpx: true,
    isGlobal: false,
  };
}

/**
 * Obtiene la versión via npx
 */
function getVersionViaNpx(): string | null {
  try {
    const output = execSync('npx opencode --version', {
      encoding: 'utf-8',
      timeout: 30000,
    });

    const match = output.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Obtiene la versión desde un path específico
 */
function getVersionFromPath(cliPath: string): string | null {
  try {
    const output = execSync(`"${cliPath}" --version`, {
      encoding: 'utf-8',
      timeout: 10000,
    });

    const match = output.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Obtiene los paths globales de npm/yarn
 */
function getGlobalPaths(): string[] {
  const paths: string[] = [];
  const isWindows = process.platform === 'win32';

  // npm global prefix
  try {
    const npmPrefix = execSync('npm config get prefix', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    if (npmPrefix) {
      paths.push(isWindows ? npmPrefix : path.join(npmPrefix, 'bin'));
    }
  } catch {
    // Ignore
  }

  // yarn global prefix
  try {
    const yarnPrefix = execSync('yarn global dir', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    if (yarnPrefix) {
      paths.push(path.join(yarnPrefix, 'node_modules', '.bin'));
    }
  } catch {
    // Ignore
  }

  // Paths comunes
  if (isWindows) {
    const appData = process.env.APPDATA;
    if (appData) {
      paths.push(path.join(appData, 'npm'));
    }
  } else {
    paths.push('/usr/local/bin');
    paths.push('/usr/bin');
    paths.push(path.join(os.homedir(), '.npm-global', 'bin'));
  }

  return [...new Set(paths)];
}

/**
 * Verifica si el CLI está disponible
 */
export function isCliAvailable(): boolean {
  try {
    const info = resolveOpenCodeCli();
    return info.version !== null || info.isNpx;
  } catch {
    return false;
  }
}

/**
 * Obtiene el comando base para ejecutar OpenCode
 */
export function getOpenCodeCommand(): string {
  const info = resolveOpenCodeCli();

  if (info.isNpx) {
    return 'npx opencode';
  }

  return `"${info.path}"`;
}
