/**
 * Sheets Tools - Herramientas para Google Sheets
 *
 * Proporciona herramientas para leer y escribir Google Sheets
 * mediante la API de Google
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SheetsReadInput {
  spreadsheetId: string;
  range: string;
  apiKey?: string;
}

export interface SheetsWriteInput {
  spreadsheetId: string;
  range: string;
  values: any[][];
  apiKey?: string;
}

export interface SheetsAppendInput {
  spreadsheetId: string;
  range: string;
  values: any[][];
  apiKey?: string;
}

export interface SheetsReadOutput {
  success: boolean;
  data?: any[][];
  range?: string;
  majorDimension?: string;
}

export interface SheetsWriteOutput {
  success: boolean;
  updatedRows?: number;
  updatedCells?: number;
}

/**
 * Lee datos de una hoja de Google Sheets
 */
export async function sheetsRead(input: SheetsReadInput): Promise<SheetsReadOutput> {
  try {
    // Obtener API key del tenant o usar la proporcionada
    const apiKey = input.apiKey;

    if (!apiKey) {
      throw new Error('Se requiere API key de Google Sheets');
    }

    // Construir URL
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(input.range)}?key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorData: any = await response.json();
      throw new Error(errorData.error?.message || 'Error obteniendo datos de Google Sheets');
    }

    const result: any = await response.json();

    return {
      success: true,
      data: result.values,
      range: result.range,
      majorDimension: result.majorDimension,
    };
  } catch (error: any) {
    return {
      success: false,
      data: [[error.message || 'Error leyendo Google Sheets']],
    };
  }
}

/**
 * Escribe datos en una hoja de Google Sheets
 */
export async function sheetsWrite(input: SheetsWriteInput): Promise<SheetsWriteOutput> {
  try {
    const apiKey = input.apiKey;

    if (!apiKey) {
      throw new Error('Se requiere API key de Google Sheets');
    }

    // Para escribir necesitamos un access token (OAuth), no solo API key
    // Esta es una implementación simplificada - en producción se necesita OAuth
    throw new Error('Para escribir en Google Sheets se requiere autenticación OAuth. Configura las credenciales OAuth del tenant.');

    // URL para actualizar valores
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(input.range)}?valueInputOption=RAW`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`, // En producción esto sería un OAuth token
      },
      body: JSON.stringify({
        values: input.values,
      }),
    });

    if (!response.ok) {
      const errorData: any = await response.json();
      throw new Error(errorData.error?.message || 'Error escribiendo en Google Sheets');
    }

    const result: any = await response.json();

    return {
      success: true,
      updatedRows: result.updatedRows,
      updatedCells: result.updatedCells,
    };
  } catch (error: any) {
    return {
      success: false,
      updatedRows: 0,
      updatedCells: 0,
    };
  }
}

/**
 * Agrega datos a una hoja de Google Sheets
 */
export async function sheetsAppend(input: SheetsAppendInput): Promise<SheetsWriteOutput> {
  try {
    const apiKey = input.apiKey;

    if (!apiKey) {
      throw new Error('Se requiere API key de Google Sheets');
    }

    // Similar a sheetsWrite, se requiere OAuth para append
    throw new Error('Para agregar datos en Google Sheets se requiere autenticación OAuth. Configura las credenciales OAuth del tenant.');

    // URL para agregar valores
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(input.range)}:append?valueInputOption=RAW`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        values: input.values,
      }),
    });

    if (!response.ok) {
      const errorData: any = await response.json();
      throw new Error(errorData.error?.message || 'Error agregando datos a Google Sheets');
    }

    const result: any = await response.json();

    return {
      success: true,
      updatedRows: result.updates?.updatedRows,
      updatedCells: result.updates?.updatedCells,
    };
  } catch (error: any) {
    return {
      success: false,
      updatedRows: 0,
      updatedCells: 0,
    };
  }
}

/**
 * Definiciones de herramientas para OpenCode
 */
export const sheetsTools = {
  sheets_read: {
    name: 'sheets_read',
    description: 'Lee datos de una hoja de cálculo de Google Sheets',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'ID del spreadsheet (desde la URL)',
        },
        range: {
          type: 'string',
          description: 'Rango a leer (ej: "Hoja1!A1:C10")',
        },
        apiKey: {
          type: 'string',
          description: 'API key de Google (opcional si está configurada en el tenant)',
        },
      },
      required: ['spreadsheetId', 'range'],
    },
    category: 'integration',
    dangerous: false,
    handler: sheetsRead,
  },

  sheets_write: {
    name: 'sheets_write',
    description: 'Escribe datos en una hoja de cálculo de Google Sheets (requiere OAuth)',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'ID del spreadsheet',
        },
        range: {
          type: 'string',
          description: 'Rango a escribir (ej: "Hoja1!A1")',
        },
        values: {
          type: 'array',
          items: {
            type: 'array',
            items: {},
          },
          description: 'Matriz de valores a escribir',
        },
        apiKey: {
          type: 'string',
          description: 'Token OAuth de Google (requerido para escribir)',
        },
      },
      required: ['spreadsheetId', 'range', 'values'],
    },
    category: 'integration',
    dangerous: true,
    handler: sheetsWrite as any,
  },

  sheets_append: {
    name: 'sheets_append',
    description: 'Agrega datos a una hoja de cálculo de Google Sheets (requiere OAuth)',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'ID del spreadsheet',
        },
        range: {
          type: 'string',
          description: 'Rango donde agregar (ej: "Hoja1!A:A")',
        },
        values: {
          type: 'array',
          items: {
            type: 'array',
            items: {},
          },
          description: 'Matriz de valores a agregar',
        },
        apiKey: {
          type: 'string',
          description: 'Token OAuth de Google (requerido para escribir)',
        },
      },
      required: ['spreadsheetId', 'range', 'values'],
    },
    category: 'integration',
    dangerous: true,
    handler: sheetsAppend as any,
  },
};
