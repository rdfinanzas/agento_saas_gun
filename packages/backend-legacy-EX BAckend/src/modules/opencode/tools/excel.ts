/**
 * ExcelTool - Herramienta para trabajar con archivos Excel
 * Permite al agente leer, escribir y analizar archivos Excel
 */

import z from 'zod';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { Tool } from './tool';

async function readExcelData(filePath: string, sheetName?: string, opts?: { headerRow?: boolean; maxRows?: number }) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }
  const workbook = xlsx.readFile(filePath);
  const sheets = workbook.SheetNames;
  const targetSheet = sheetName || sheets[0];
  const worksheet = workbook.Sheets[targetSheet];
  const headerRow = opts?.headerRow !== false;
  const maxRows = opts?.maxRows || 1000;
  const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: headerRow ? 1 : 0, range: 0, defval: '' });
  const limitedData = jsonData.slice(0, maxRows);
  return {
    sheet: targetSheet,
    availableSheets: sheets,
    totalRows: jsonData.length,
    returnedRows: limitedData.length,
    data: limitedData,
  };
}

async function writeExcelData(filePath: string, sheetName: string | undefined, dataArr: any[]) {
  const worksheet = xlsx.utils.json_to_sheet(dataArr);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName || 'Sheet1');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  xlsx.writeFile(workbook, filePath);
  return { file: filePath, rows: dataArr.length };
}

async function createExcelData(filePath: string, dataObj: any) {
  let workbook: xlsx.WorkBook;
  if (typeof dataObj === 'object' && !Array.isArray(dataObj)) {
    workbook = xlsx.utils.book_new();
    for (const [sn, sd] of Object.entries(dataObj)) {
      const worksheet = xlsx.utils.json_to_sheet(Array.isArray(sd) ? sd : [sd]);
      xlsx.utils.book_append_sheet(workbook, worksheet, sn);
    }
  } else {
    workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(Array.isArray(dataObj) ? dataObj : [dataObj]);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  xlsx.writeFile(workbook, filePath);
  return { file: filePath };
}

async function analyzeExcelData(filePath: string, sheetName?: string, q?: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }
  const workbook = xlsx.readFile(filePath);
  const targetSheet = sheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[targetSheet];
  const data = xlsx.utils.sheet_to_json(worksheet);
  let analysis = `Análisis de: ${path.basename(filePath)}\nHoja: ${targetSheet}\nTotal de filas: ${data.length}\n\n`;
  if (data.length > 0) {
    const columns = Object.keys(data[0] as object);
    analysis += `Columnas: ${columns.join(', ')}\n\n`;
  }
  return analysis;
}

async function listSheetsData(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }
  const workbook = xlsx.readFile(filePath);
  return workbook.SheetNames.map(name => {
    const worksheet = workbook.Sheets[name];
    const d = xlsx.utils.sheet_to_json(worksheet);
    return { name, rows: d.length };
  });
}

async function getInfoData(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }
  const workbook = xlsx.readFile(filePath);
  const stats = fs.statSync(filePath);
  return {
    file: path.basename(filePath),
    fullPath: filePath,
    size: stats.size,
    sheets: workbook.SheetNames,
    sheetCount: workbook.SheetNames.length,
  };
}

export const ExcelTool = Tool.define('excel', {
  description: 'Herramienta para trabajar con archivos Excel',
  parameters: z.object({
    operation: z.enum(['read', 'write', 'analyze', 'create', 'list_sheets', 'info']).describe('Operación'),
    filePath: z.string().describe('Ruta al archivo Excel').optional(),
    sheetName: z.string().describe('Nombre de la hoja').optional(),
    data: z.any().describe('Datos a escribir').optional(),
    query: z.string().describe('Consulta').optional(),
    options: z.object({
      headerRow: z.boolean().describe('Primera fila es encabezado'),
      maxRows: z.number().describe('Máximo de filas'),
    }).optional(),
  }),
  async execute(params, ctx) {
    const { operation, filePath, sheetName, data, query, options } = params;
    try {
      let output = '';
      let metadata: Record<string, any> = {};
      switch (operation) {
        case 'read': {
          const result = await readExcelData(filePath!, sheetName, options);
          output = JSON.stringify(result, null, 2);
          metadata = { file: filePath, sheet: result.sheet, rows: result.returnedRows };
          break;
        }
        case 'write': {
          const result = await writeExcelData(filePath!, sheetName, data || []);
          output = `Archivo creado: ${filePath}\nFilas: ${result.rows}`;
          metadata = result;
          break;
        }
        case 'create': {
          const result = await createExcelData(filePath!, data);
          output = `Archivo creado: ${filePath}`;
          metadata = result;
          break;
        }
        case 'analyze': {
          output = await analyzeExcelData(filePath!, sheetName, query);
          break;
        }
        case 'list_sheets': {
          const result = await listSheetsData(filePath!);
          output = JSON.stringify(result, null, 2);
          metadata = { count: result.length };
          break;
        }
        case 'info': {
          const result = await getInfoData(filePath!);
          output = JSON.stringify(result, null, 2);
          metadata = result;
          break;
        }
        default:
          throw new Error(`Operación desconocida: ${operation}`);
      }
      return { title: `Excel: ${operation}`, output, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { title: `Error Excel: ${operation}`, output: `Error: ${message}`, metadata: { error: message } };
    }
  },
});
