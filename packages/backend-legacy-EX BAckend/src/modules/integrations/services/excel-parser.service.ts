import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export interface SheetData {
  name: string;
  rows: any[];
  columns: string[];
}

export interface ParsedExcel {
  sheets: Record<string, any[]>;
  summary: {
    name: string;
    rows: number;
    columns: string[];
  }[];
}

export interface KnowledgeBaseData {
  products?: any[];
  prices?: Record<string, number>;
  stock?: Record<string, number>;
  faq?: any[];
  custom?: any;
}

export class ExcelParserService {
  /**
   * Parsea un archivo Excel y retorna los datos de todas las hojas
   */
  async parse(filePath: string): Promise<ParsedExcel> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo no encontrado: ${filePath}`);
    }

    const workbook = xlsx.readFile(filePath);
    const sheets: Record<string, any[]> = {};
    const summary: ParsedExcel['summary'] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);

      sheets[sheetName] = data;

      summary.push({
        name: sheetName,
        rows: data.length,
        columns: data.length > 0 ? Object.keys(data[0] as Record<string, unknown>) : []
      });
    }

    return {
      sheets,
      summary
    };
  }

  /**
   * Genera una knowledge base desde un archivo Excel
   * Detecta automáticamente el tipo de contenido por el nombre de las hojas
   */
  async generateKnowledgeBase(filePath: string): Promise<KnowledgeBaseData> {
    const { sheets } = await this.parse(filePath);

    const knowledgeBase: KnowledgeBaseData = {
      products: [],
      prices: {},
      stock: {},
      faq: [],
      custom: {}
    };

    // Procesar hojas según su nombre
    for (const [sheetName, data] of Object.entries(sheets)) {
      const normalizedName = sheetName.toLowerCase();

      // Detectar productos
      if (normalizedName.includes('producto') || normalizedName.includes('product')) {
        knowledgeBase.products = data;
      }

      // Detectar precios
      if (normalizedName.includes('precio') || normalizedName.includes('price')) {
        data.forEach((row: any) => {
          // Buscar columnas comunes de producto y precio
          const productKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('producto') ||
            k.toLowerCase().includes('product') ||
            k.toLowerCase().includes('nombre') ||
            k.toLowerCase().includes('name')
          );

          const priceKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('precio') ||
            k.toLowerCase().includes('price')
          );

          if (productKey && priceKey && row[productKey] && row[priceKey]) {
            const price = parseFloat(row[priceKey]);
            if (!isNaN(price)) {
              knowledgeBase.prices![row[productKey]] = price;
            }
          }
        });
      }

      // Detectar stock
      if (normalizedName.includes('stock') || normalizedName.includes('inventario')) {
        data.forEach((row: any) => {
          const productKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('producto') ||
            k.toLowerCase().includes('product') ||
            k.toLowerCase().includes('nombre')
          );

          const quantityKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('cantidad') ||
            k.toLowerCase().includes('quantity') ||
            k.toLowerCase().includes('stock')
          );

          if (productKey && quantityKey && row[productKey] && row[quantityKey]) {
            const quantity = parseInt(row[quantityKey]);
            if (!isNaN(quantity)) {
              knowledgeBase.stock![row[productKey]] = quantity;
            }
          }
        });
      }

      // Detectar FAQ
      if (normalizedName.includes('faq') ||
          normalizedName.includes('pregunta') ||
          normalizedName.includes('preguntas')) {
        knowledgeBase.faq = data;
      }

      // Otras hojas se guardan en custom
      if (!['producto', 'product', 'precio', 'price', 'stock', 'inventario', 'faq', 'pregunta', 'preguntas']
           .some(k => normalizedName.includes(k))) {
        knowledgeBase.custom![sheetName] = data;
      }
    }

    return knowledgeBase;
  }

  /**
   * Convierte datos JSON a Excel
   */
  async jsonToExcel(data: Record<string, any[]>, outputPath: string): Promise<void> {
    const workbook = xlsx.utils.book_new();

    for (const [sheetName, sheetData] of Object.entries(data)) {
      const worksheet = xlsx.utils.json_to_sheet(sheetData);
      xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    xlsx.writeFile(workbook, outputPath);
  }

  /**
   * Valida que un archivo sea un Excel válido
   */
  validateExcel(filePath: string): boolean {
    try {
      const workbook = xlsx.readFile(filePath);
      return workbook.SheetNames.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extrae estadísticas del archivo
   */
  getStatistics(parsed: ParsedExcel): {
    totalSheets: number;
    totalRows: number;
    sheetsWithMostRows: { name: string; rows: number }[];
  } {
    const totalRows = parsed.summary.reduce((sum, sheet) => sum + sheet.rows, 0);
    const maxRows = Math.max(...parsed.summary.map(s => s.rows));
    const sheetsWithMostRows = parsed.summary
      .filter(s => s.rows === maxRows)
      .map(s => ({ name: s.name, rows: s.rows }));

    return {
      totalSheets: parsed.summary.length,
      totalRows,
      sheetsWithMostRows
    };
  }
}
