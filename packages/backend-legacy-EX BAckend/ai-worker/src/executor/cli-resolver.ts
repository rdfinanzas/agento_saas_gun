/**
 * CLI Resolver para AI Worker
 */

import * as path from 'path';
import * as fs from 'fs';
import { execFileSync } from 'child_process';

export interface ResolvedCliPaths {
  cliPath: string;
  cliDir: string;
  source: 'bundled' | 'local' | 'npx';
}

export class CliResolverService {
  private cachedPath: ResolvedCliPaths | null = null;

  async resolve(): Promise<ResolvedCliPaths> {
    if (this.cachedPath) {
      return this.cachedPath;
    }

    const local = this.resolveLocalCli();
    if (local) {
      this.cachedPath = local;
      return local;
    }

    const npxPath = this.resolveNpxCli();
    this.cachedPath = npxPath;
    return npxPath;
  }

  private resolveLocalCli(): ResolvedCliPaths | null {
    const binaryName = process.platform === 'win32' ? 'opencode.exe' : 'opencode';
    
    const searchPaths = [
      path.join(process.cwd(), 'binaries', 'opencode-windows-x64', 'bin', binaryName),
      path.join(process.cwd(), 'node_modules', '.bin', binaryName),
      path.join(process.cwd(), '..', 'ai-worker', 'binaries', 'opencode-windows-x64', 'bin', binaryName),
      path.join(process.cwd(), '..', 'backend', 'node_modules', '.bin', binaryName),
    ];

    for (const cliPath of searchPaths) {
      if (fs.existsSync(cliPath)) {
        return {
          cliPath,
          cliDir: path.dirname(cliPath),
          source: 'bundled',
        };
      }
    }

    return null;
  }

  private resolveNpxCli(): ResolvedCliPaths {
    return {
      cliPath: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      cliDir: '.',
      source: 'npx',
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const resolved = await this.resolve();
      const args = resolved.source === 'npx' ? ['opencode', '--version'] : ['--version'];
      
      execFileSync(resolved.cliPath, args, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      
      return true;
    } catch {
      return false;
    }
  }
}
