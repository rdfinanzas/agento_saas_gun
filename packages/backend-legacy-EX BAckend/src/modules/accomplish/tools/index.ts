/**
 * Tools Index - Índice de herramientas dinámicas
 *
 * Exporta todas las herramientas disponibles para Accomplish
 */

import { excelTools, excelRead, excelWrite, excelInfo } from './excel.tools';
import { sheetsTools, sheetsRead, sheetsWrite, sheetsAppend } from './sheets.tools';
import {
  knowledgeTools,
  knowledgeQuery,
  knowledgeAdd,
  knowledgeStats,
  knowledgeDelete,
} from './knowledge.tools';

// Re-exportar funciones individuales
export { excelRead, excelWrite, excelInfo };
export { sheetsRead, sheetsWrite, sheetsAppend };
export { knowledgeQuery, knowledgeAdd, knowledgeStats, knowledgeDelete };

/**
 * Mapa de todas las herramientas disponibles
 */
export const allTools = {
  // Excel tools
  ...excelTools,
  // Sheets tools
  ...sheetsTools,
  // Knowledge tools
  ...knowledgeTools,
};

/**
 * Obtiene una herramienta por nombre
 */
export function getTool(name: string) {
  return allTools[name as keyof typeof allTools];
}

/**
 * Lista todas las herramientas disponibles
 */
export function listTools(): string[] {
  return Object.keys(allTools);
}

/**
 * Lista herramientas por categoría
 */
export function listToolsByCategory(category: string): string[] {
  return Object.entries(allTools)
    .filter(([_, tool]) => (tool as any).category === category)
    .map(([name]) => name);
}

/**
 * Verifica si una herramienta es peligrosa
 */
export function isToolDangerous(name: string): boolean {
  const tool = getTool(name);
  return tool ? (tool as any).dangerous === true : false;
}
