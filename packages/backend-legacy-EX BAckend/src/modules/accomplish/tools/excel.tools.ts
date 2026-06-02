/**
 * Excel Tools - Herramientas para manipulación de archivos Excel
 *
 * Proporciona herramientas para leer y escribir archivos Excel
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ExcelReadInput {
  filePath: string;
  sheetName?: string;
  range?: string;
}

export interface ExcelWriteInput {
  filePath: string;
  data: Record<string, any>[] | Record<string, Record<string, any>>;
  sheetName?: string;
  options?: {
    createDir?: boolean;
  };
}

export interface ExcelReadOutput {
  success: boolean;
  data: any;
  sheetNames?: string[];
  metadata?: {
    sheets: number;
    rows: number;
    columns: number;
  };
}

export interface ExcelWriteOutput {
  success: boolean;
  filePath: string;
  sheets?: number;
  rows?: number;
}

/**
 * Lee un archivo Excel
 */
export async function excelRead(input: ExcelReadInput): Promise<ExcelReadOutput> {
  try {
    // Verificar que el archivo existe
    await fs.access(input.filePath);

    // Leer el workbook
    const workbook = XLSX.readFile(input.filePath);

    // Obtener el nombre de la hoja
    const sheetName = input.sheetName || workbook.SheetNames[0];

    if (!workbook.Sheets[sheetName]) {
      throw new Error(`Hoja "${sheetName}" no encontrada`);
    }

    // Obtener la hoja
    const worksheet = workbook.Sheets[sheetName];

    // Convertir a JSON
    const data = XLSX.utils.sheet_to_json(worksheet, {
      range: input.range,
    });

    // Obtener rangos
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const rows = range.e.r + 1;
    const columns = range.e.c + 1;

    return {
      success: true,
      data,
      sheetNames: workbook.SheetNames,
      metadata: {
        sheets: workbook.SheetNames.length,
        rows,
        columns,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      data: error.message || 'Error leyendo archivo Excel',
    };
  }
}

/**
 * Escribe datos a un archivo Excel
 */
export async function excelWrite(input: ExcelWriteInput): Promise<ExcelWriteOutput> {
  try {
    const { filePath, data, sheetName = 'Sheet1', options = {} } = input;

    // Crear directorio si no existe
    if (options.createDir) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    }

    // Crear workbook
    const workbook = XLSX.utils.book_new();

    if (Array.isArray(data)) {
      // Array de objetos -> una hoja
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    } else {
      // Objeto de objetos -> múltiples hojas
      for (const [name, sheetData] of Object.entries(data)) {
        const worksheet = XLSX.utils.json_to_sheet(sheetData as any[]);
        XLSX.utils.book_append_sheet(workbook, worksheet, name);
      }
    }

    // Escribir archivo
    XLSX.writeFile(workbook, filePath);

    // Calcular filas
    let rows = 0;
    if (Array.isArray(data)) {
      rows = data.length;
    } else {
      rows = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
    }

    return {
      success: true,
      filePath,
      sheets: workbook.SheetNames.length,
      rows,
    };
  } catch (error: any) {
    return {
      success: false,
      filePath: input.filePath,
    };
  }
}

/**
 * Obtiene información de un archivo Excel
 */
export async function excelInfo(filePath: string): Promise<{
  success: boolean;
  sheetNames?: string[];
  metadata?: Record<string, any>;
}> {
  try {
    await fs.access(filePath);
    const workbook = XLSX.readFile(filePath);

    const metadata: Record<string, any> = {};

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      metadata[sheetName] = {
        rows: range.e.r + 1,
        columns: range.e.c + 1,
      };
    }

    return {
      success: true,
      sheetNames: workbook.SheetNames,
      metadata,
    };
  } catch (error: any) {
    return {
      success: false,
    };
  }
}

/**
 * Definiciones de herramientas para OpenCode
 */
export const excelTools = {
  excel_read: {
    name: 'excel_read',
    description: 'Lee datos de un archivo Excel (.xlsx, .xls)',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Ruta del archivo Excel',
        },
        sheetName: {
          type: 'string',
          description: 'Nombre de la hoja (opcional, usa la primera por defecto)',
        },
        range: {
          type: 'string',
          description: 'Rango a leer (ej: "A1:C10")',
        },
      },
      required: ['filePath'],
    },
    category: 'data',
    dangerous: false,
    handler: excelRead,
  },

  excel_write: {
    name: 'excel_write',
    description: 'Escribe datos a un archivo Excel',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Ruta del archivo a crear',
        },
        data: {
          type: 'object',
          oneOf: [
            {
              type: 'array',
              items: {
                type: 'object',
              },
            },
            {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: {
                  type: 'object',
                },
              },
            },
          ],
        },
        sheetName: {
          type: 'string',
          description: 'Nombre de la hoja (por defecto "Sheet1")',
        },
        createDir: {
          type: 'boolean',
          description: 'Crear directorio si no existe',
        },
      },
      required: ['filePath', 'data'],
    },
    category: 'data',
    dangerous: true,
    handler: excelWrite,
  },

  excel_info: {
    name: 'excel_info',
    description: 'Obtiene información de un archivo Excel (hojas, dimensiones)',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Ruta del archivo Excel',
        },
      },
      required: ['filePath'],
    },
    category: 'data',
    dangerous: false,
    handler: async (input: { filePath: string }) => {
      const result = await excelInfo(input.filePath);
      return result;
    },
  },
};
