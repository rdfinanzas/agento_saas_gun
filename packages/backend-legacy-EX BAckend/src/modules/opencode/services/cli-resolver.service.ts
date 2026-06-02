import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';

export interface ResolvedCliPaths {
  cliPath: string;
  cliDir: string;
  source: 'bundled' | 'local' | 'npx';
}

export interface CliResolution {
  source: 'system' | 'npx' | 'download' | 'local';
  command: string;
  args: string[];
  version?: string;
}

export class CliResolverService {
  private cachedPath: ResolvedCliPaths | null = null;

  private readonly WINDOWS_BINARIES = {
    'win32-x64': {
      avx2: 'opencode-windows-x64',
      baseline: 'opencode-windows-x64-baseline',
      binaryName: 'opencode.exe',
    },
  };

  private readonly UNIX_BINARIES = {
    'darwin-x64': { packageName: 'opencode-ai', binaryName: 'opencode' },
    'darwin-arm64': { packageName: 'opencode-ai', binaryName: 'opencode' },
    'linux-x64': { packageName: 'opencode-ai', binaryName: 'opencode' },
  };

  /**
   * Detecta soporte AVX2 en Windows para elegir el binario óptimo
   */
  private detectWindowsAvx2Support(): boolean {
    if (process.platform !== 'win32') return false;

    const checkCommand =
      '(Add-Type -MemberDefinition "[DllImport(\\"kernel32.dll\\")] public static extern bool IsProcessorFeaturePresent(int ProcessorFeature);" -Name Kernel32 -Namespace Win32 -PassThru)::IsProcessorFeaturePresent(40)';

    for (const shell of ['powershell.exe', 'pwsh.exe', 'pwsh', 'powershell']) {
      try {
        const result = require('child_process').spawnSync(
          shell,
          ['-NoProfile', '-NonInteractive', '-Command', checkCommand],
          {
            encoding: 'utf-8',
            timeout: 3000,
            stdio: ['ignore', 'pipe', 'ignore'],
            windowsHide: true,
          }
        );

        if (result.status !== 0) continue;

        const output = (result.stdout ?? '').trim().toLowerCase();
        if (output === 'true' || output === '1') return true;
        if (output === 'false' || output === '0') return false;
      } catch {
        continue;
      }
    }

    return false; // Default to baseline if detection fails
  }

  /**
   * Obtiene información de plataforma para binarios OpenCode
   */
  private getPlatformInfo(): {
    packageNames: string[];
    binaryName: string;
  } {
    const platform = process.platform;
    const arch = process.arch;

    if (platform === 'win32' && arch === 'x64') {
      const preferAvx2 = this.detectWindowsAvx2Support();
      const config = this.WINDOWS_BINARIES['win32-x64'];
      return {
        packageNames: preferAvx2
          ? [config.avx2, config.baseline]
          : [config.baseline, config.avx2],
        binaryName: config.binaryName,
      };
    }

    const key = `${platform}-${arch}` as keyof typeof this.UNIX_BINARIES;
    const config = this.UNIX_BINARIES[key];

    if (!config) {
      // Fallback to default
      return {
        packageNames: ['opencode-ai'],
        binaryName: 'opencode',
      };
    }

    return {
      packageNames: [config.packageName],
      binaryName: config.binaryName,
    };
  }

  /**
   * Resuelve el binario desde node_modules local
   */
  private resolveLocalCli(): ResolvedCliPaths | null {
    const { packageNames, binaryName } = this.getPlatformInfo();
    const cwd = process.cwd();

    // Buscar en múltiples ubicaciones
    const searchPaths = [
      path.join(cwd, 'node_modules'), // Paquete actual
      path.join(cwd, '..', 'ai-worker', 'node_modules'), // Ai-worker sibling
      path.join(cwd, '..', '..', 'node_modules'), // Root node_modules
    ];

    for (const searchPath of searchPaths) {
      for (const packageName of packageNames) {
        // Unix-style bin directory
        const unixBinPath = path.join(searchPath, '.bin', binaryName);
        if (fs.existsSync(unixBinPath)) {
          console.log(`[CLI Resolver] Found OpenCode at: ${unixBinPath}`);
          return {
            cliPath: unixBinPath,
            cliDir: path.dirname(unixBinPath),
            source: 'local',
          };
        }

        // Windows-style bin directory
        const windowsBinPath = path.join(searchPath, packageName, 'bin', binaryName);
        if (fs.existsSync(windowsBinPath)) {
          console.log(`[CLI Resolver] Found OpenCode at: ${windowsBinPath}`);
          return {
            cliPath: windowsBinPath,
            cliDir: path.dirname(windowsBinPath),
            source: 'local',
          };
        }
      }
    }

    return null;
  }

  /**
   * Resuelve el binario usando npx como fallback
   */
  private resolveNpxCli(): ResolvedCliPaths {
    const npxPath = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    console.log('[CLI Resolver] Using npx fallback for OpenCode');
    return {
      cliPath: npxPath,
      cliDir: '.',
      source: 'npx',
    };
  }

  /**
   * Resuelve la ruta al binario de OpenCode
   */
  async resolve(): Promise<ResolvedCliPaths> {
    if (this.cachedPath) {
      return this.cachedPath;
    }

    // Intentar resolver localmente
    const localPath = this.resolveLocalCli();
    if (localPath) {
      this.cachedPath = localPath;
      return localPath;
    }

    // Fallback a npx
    const npxPath = this.resolveNpxCli();
    this.cachedPath = npxPath;
    return npxPath;
  }

  /**
   * Obtiene la versión de OpenCode instalada
   */
  async getCliVersion(): Promise<string | null> {
    try {
      const resolved = await this.resolve();
      const args = resolved.source === 'npx' ? ['opencode', '--version'] : ['--version'];

      const output = execFileSync(resolved.cliPath, args, {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
      return versionMatch ? versionMatch[1] : output;
    } catch (error) {
      console.error('[CLI Resolver] Failed to get version:', error);
      return null;
    }
  }

  /**
   * Verifica si OpenCode está disponible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const version = await this.getCliVersion();
      return version !== null;
    } catch {
      return false;
    }
  }

  /**
   * Limpia el caché de resolución
   */
clearCache(): void {
    this.cachedPath = null;
  }

  async resolveForOpenCode(): Promise<CliResolution> {
    const local = this.resolveLocalCli();
    if (local) {
      return {
        source: 'local',
        command: local.cliPath,
        args: [],
      };
    }

    return {
      source: 'npx',
      command: 'npx',
      args: ['opencode'],
    };
  }
}

let cliResolverInstance: CliResolverService | null = null;

export function getCliResolver(): CliResolverService {
  if (!cliResolverInstance) {
    cliResolverInstance = new CliResolverService();
  }
  return cliResolverInstance;
}

export async function resolveOpenCodeCli(): Promise<CliResolution> {
  const resolver = getCliResolver();
  return resolver.resolveForOpenCode();
}
