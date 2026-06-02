/**
 * SkillWrapperService - Crea wrappers para ejecutar skills desde OpenCode
 *
 * Crea scripts que OpenCode puede ejecutar para invocar skills instalados
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

export class SkillWrapperService {
  private readonly WRAPPER_DIR = 'skill_wrappers';

  /**
   * Crea el directorio de wrappers en el workspace del tenant
   */
  async createWrappersDirectory(tenantId: string, workspacePath: string): Promise<string> {
    const wrapperDir = path.join(workspacePath, this.WRAPPER_DIR);

    try {
      await fs.mkdir(wrapperDir, { recursive: true });
      console.log(`[SkillWrapper] Created wrappers directory: ${wrapperDir}`);
      return wrapperDir;
    } catch (error) {
      console.error(`[SkillWrapper] Error creating wrappers directory:`, error);
      throw error;
    }
  }

  /**
   * Crea un wrapper para un skill específico
   */
  async createSkillWrapper(
    tenantId: string,
    workspacePath: string,
    toolName: string,
    toolDefinition: any
  ): Promise<void> {
    const wrapperDir = await this.createWrappersDirectory(tenantId, workspacePath);

    // Crear wrapper en Python
    const pythonWrapper = this.generatePythonWrapper(tenantId, toolName, toolDefinition);
    const wrapperPath = path.join(wrapperDir, `${toolName}.py`);

    await fs.writeFile(wrapperPath, pythonWrapper);
    console.log(`[SkillWrapper] Created Python wrapper: ${wrapperPath}`);
  }

  /**
   * Genera un wrapper Python para ejecutar un skill
   */
  private generatePythonWrapper(tenantId: string, toolName: string, toolDefinition: any): string {
    return `#!/usr/bin/env python3
"""
Skill Wrapper: ${toolName}
Este wrapper ejecuta el skill ${toolName} instalado en el sistema
"""

import sys
import json
import urllib.request
import urllib.error
from typing import Dict, Any

API_BASE = process.env.get('API_BASE_URL', 'http://localhost:3000')
ENDPOINT = f'{API_BASE}/api/v1/{tenantId}/agents/skills/execute'

def execute_skill(input_params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ejecuta el skill llamando a la API del backend
    """
    try:
        payload = {
            'toolName': '${toolName}',
            'input': input_params
        }

        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            ENDPOINT,
            data=data,
            headers={
                'Content-Type': 'application/json'
            }
        )

        with urllib.request.urlopen(req) as response:
            response_data = json.loads(response.read().decode('utf-8'))
            return response_data

    except urllib.error.HTTPError as e:
        error_data = json.loads(e.read().decode('utf-8'))
        return {
            'success': False,
            'error': error_data.get('error', str(e))
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python ${toolName}.py \\'{"param": "value"}\\''
        }))
        sys.exit(1)

    try:
        input_params = json.loads(sys.argv[1])
        result = execute_skill(input_params)
        print(json.dumps(result, indent=2))

        # Exit con código apropiado
        sys.exit(0 if result.get('success') else 1)

    except json.JSONDecodeError as e:
        print(json.dumps({
            'success': False,
            'error': f'Invalid JSON input: {e}'
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
`;
  }

  /**
   * Crea wrappers para todos los skills instalados de un tenant
   */
  async createAllSkillWrappers(
    tenantId: string,
    workspacePath: string,
    skillTools: any[]
  ): Promise<void> {
    // Crear directorio
    await this.createWrappersDirectory(tenantId, workspacePath);

    // Crear wrapper por cada herramienta de skill
    for (const tool of skillTools) {
      if (tool.handler === 'skill') {
        await this.createSkillWrapper(tenantId, workspacePath, tool.name, tool);
      }
    }
  }

  /**
   * Elimina todos los wrappers de un tenant
   */
  async cleanupWrappers(workspacePath: string): Promise<void> {
    const wrapperDir = path.join(workspacePath, this.WRAPPER_DIR);

    try {
      await fs.rm(wrapperDir, { recursive: true, force: true });
      console.log(`[SkillWrapper] Cleaned up wrappers directory`);
    } catch (error) {
      console.error(`[SkillWrapper] Error cleaning up wrappers:`, error);
    }
  }

  /**
   * Obtiene el path del ejecutable de un wrapper
   */
  getWrapperPath(toolName: string, workspacePath: string): string {
    return path.join(workspacePath, this.WRAPPER_DIR, `${toolName}.py`);
  }
}

// Singleton instance
export const skillWrapperService = new SkillWrapperService();
