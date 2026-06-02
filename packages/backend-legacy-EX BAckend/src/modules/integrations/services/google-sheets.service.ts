import { prisma } from '../../../config/database';
import { JWT } from 'google-auth-library';
import { google, sheets_v4 } from 'googleapis';

export interface GoogleSheetsConfig {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
}

export interface SheetRange {
  sheetName: string;
  range: string;
}

export interface SheetData {
  headers: string[];
  rows: any[][];
}

export class GoogleSheetsService {
  private getAuthClient(config: GoogleSheetsConfig): JWT {
    return new JWT({
      email: config.clientEmail,
      key: config.privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  private async getSheetsClient(config: GoogleSheetsConfig): Promise<sheets_v4.Sheets> {
    const auth = this.getAuthClient(config);
    return google.sheets({ version: 'v4', auth });
  }

  async connect(tenantId: string, config: GoogleSheetsConfig): Promise<{ success: boolean; title?: string; error?: string }> {
    try {
      const sheets = await this.getSheetsClient(config);
      const response = await sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheetId,
      });

      // Store the configuration in the database
      await prisma.tenantFile.create({
        data: {
          tenantId,
          name: response.data.properties?.title || 'Google Sheet',
          path: config.spreadsheetId,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          size: BigInt(0),
          category: 'GOOGLE_SHEET',
          metadata: {
            clientEmail: config.clientEmail,
            privateKey: config.privateKey,
            spreadsheetId: config.spreadsheetId,
            title: response.data.properties?.title,
            connectedAt: new Date().toISOString(),
          },
        },
      });

      return { success: true, title: response.data.properties?.title };
    } catch (error) {
      console.error('Error connecting to Google Sheets:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async readSheet(tenantId: string, spreadsheetId: string, range?: string): Promise<SheetData | null> {
    try {
      const connection = await prisma.tenantFile.findFirst({
        where: {
          tenantId,
          path: spreadsheetId,
          category: 'GOOGLE_SHEET',
        },
      });

      if (!connection || !connection.metadata) {
        throw new Error('Google Sheets connection not found');
      }

      const metadata = connection.metadata as any;
      const config: GoogleSheetsConfig = {
        clientEmail: metadata.clientEmail,
        privateKey: metadata.privateKey,
        spreadsheetId: metadata.spreadsheetId,
      };

      const sheets = await this.getSheetsClient(config);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: range || 'A:Z',
      });

      const values = response.data.values || [];
      const headers = values[0] || [];
      const rows = values.slice(1);

      return { headers, rows };
    } catch (error) {
      console.error('Error reading Google Sheet:', error);
      return null;
    }
  }

  async readMultipleRanges(
    tenantId: string,
    spreadsheetId: string,
    ranges: SheetRange[]
  ): Promise<Map<string, SheetData>> {
    const result = new Map<string, SheetData>();

    try {
      const connection = await prisma.tenantFile.findFirst({
        where: {
          tenantId,
          path: spreadsheetId,
          category: 'GOOGLE_SHEET',
        },
      });

      if (!connection || !connection.metadata) {
        throw new Error('Google Sheets connection not found');
      }

      const metadata = connection.metadata as any;
      const config: GoogleSheetsConfig = {
        clientEmail: metadata.clientEmail,
        privateKey: metadata.privateKey,
        spreadsheetId: metadata.spreadsheetId,
      };

      const sheets = await this.getSheetsClient(config);

      for (const rangeConfig of ranges) {
        const fullRange = `${rangeConfig.sheetName}!${rangeConfig.range}`;
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheetId,
          range: fullRange,
        });

        const values = response.data.values || [];
        const headers = values[0] || [];
        const rows = values.slice(1);

        result.set(rangeConfig.sheetName, { headers, rows });
      }

      return result;
    } catch (error) {
      console.error('Error reading multiple ranges:', error);
      return result;
    }
  }

  async getSheetNames(tenantId: string, spreadsheetId: string): Promise<string[]> {
    try {
      const connection = await prisma.tenantFile.findFirst({
        where: {
          tenantId,
          path: spreadsheetId,
          category: 'GOOGLE_SHEET',
        },
      });

      if (!connection || !connection.metadata) {
        throw new Error('Google Sheets connection not found');
      }

      const metadata = connection.metadata as any;
      const config: GoogleSheetsConfig = {
        clientEmail: metadata.clientEmail,
        privateKey: metadata.privateKey,
        spreadsheetId: metadata.spreadsheetId,
      };

      const sheets = await this.getSheetsClient(config);
      const response = await sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheetId,
      });

      return response.data.sheets?.map((sheet) => sheet.properties?.title || '') || [];
    } catch (error) {
      console.error('Error getting sheet names:', error);
      return [];
    }
  }

  async generateKnowledgeBase(tenantId: string, spreadsheetId: string, sheetName?: string): Promise<any> {
    try {
      const sheetData = await this.readSheet(tenantId, spreadsheetId, sheetName ? `${sheetName}!A:Z` : undefined);

      if (!sheetData) {
        throw new Error('Could not read sheet data');
      }

      const { headers, rows } = sheetData;
      const knowledgeBase: any = {
        products: [],
        prices: {},
        stock: {},
        faq: [],
        metadata: {
          source: 'google_sheets',
          spreadsheetId,
          sheetName,
          importedAt: new Date().toISOString(),
          totalRows: rows.length,
        },
      };

      // Detect column types
      const columnTypes = this.detectColumnTypes(headers);

      for (const row of rows) {
        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = row[index] || '';
        });

        // Auto-detect data type and categorize
        if (columnTypes.productColumn && rowData[columnTypes.productColumn]) {
          knowledgeBase.products.push({
            name: rowData[columnTypes.productColumn],
            price: columnTypes.priceColumn ? parseFloat(rowData[columnTypes.priceColumn]) || 0 : 0,
            stock: columnTypes.stockColumn ? parseInt(rowData[columnTypes.stockColumn]) || 0 : 0,
            description: columnTypes.descriptionColumn ? rowData[columnTypes.descriptionColumn] : '',
            category: columnTypes.categoryColumn ? rowData[columnTypes.categoryColumn] : '',
          });
        }

        // Build price lookup
        if (columnTypes.productColumn && columnTypes.priceColumn) {
          knowledgeBase.prices[rowData[columnTypes.productColumn]?.toLowerCase()] = rowData[columnTypes.priceColumn];
        }

        // Build stock lookup
        if (columnTypes.productColumn && columnTypes.stockColumn) {
          knowledgeBase.stock[rowData[columnTypes.productColumn]?.toLowerCase()] = rowData[columnTypes.stockColumn];
        }

        // Detect FAQ patterns
        if (columnTypes.questionColumn && columnTypes.answerColumn) {
          knowledgeBase.faq.push({
            question: rowData[columnTypes.questionColumn],
            answer: rowData[columnTypes.answerColumn],
          });
        }
      }

      // Update the connected sheet with the generated knowledge base
      await prisma.tenantFile.updateMany({
        where: {
          tenantId,
          path: spreadsheetId,
          category: 'GOOGLE_SHEET',
        },
        data: {
          metadata: {
            knowledgeBase,
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return knowledgeBase;
    } catch (error) {
      console.error('Error generating knowledge base:', error);
      return null;
    }
  }

  private detectColumnTypes(headers: string[]): {
    productColumn?: string;
    priceColumn?: string;
    stockColumn?: string;
    descriptionColumn?: string;
    categoryColumn?: string;
    questionColumn?: string;
    answerColumn?: string;
  } {
    const types: any = {};

    for (const header of headers) {
      const lowerHeader = header.toLowerCase();

      if (!types.productColumn && (
        lowerHeader.includes('producto') ||
        lowerHeader.includes('product') ||
        lowerHeader.includes('nombre') ||
        lowerHeader.includes('name') ||
        lowerHeader.includes('item')
      )) {
        types.productColumn = header;
      }

      if (!types.priceColumn && (
        lowerHeader.includes('precio') ||
        lowerHeader.includes('price') ||
        lowerHeader.includes('costo') ||
        lowerHeader.includes('cost')
      )) {
        types.priceColumn = header;
      }

      if (!types.stockColumn && (
        lowerHeader.includes('stock') ||
        lowerHeader.includes('cantidad') ||
        lowerHeader.includes('quantity') ||
        lowerHeader.includes('inventario') ||
        lowerHeader.includes('inventory')
      )) {
        types.stockColumn = header;
      }

      if (!types.descriptionColumn && (
        lowerHeader.includes('descripcion') ||
        lowerHeader.includes('description') ||
        lowerHeader.includes('detalle') ||
        lowerHeader.includes('detail')
      )) {
        types.descriptionColumn = header;
      }

      if (!types.categoryColumn && (
        lowerHeader.includes('categoria') ||
        lowerHeader.includes('category') ||
        lowerHeader.includes('tipo') ||
        lowerHeader.includes('type')
      )) {
        types.categoryColumn = header;
      }

      if (!types.questionColumn && (
        lowerHeader.includes('pregunta') ||
        lowerHeader.includes('question') ||
        lowerHeader.includes('consulta')
      )) {
        types.questionColumn = header;
      }

      if (!types.answerColumn && (
        lowerHeader.includes('respuesta') ||
        lowerHeader.includes('answer') ||
        lowerHeader.includes('solucion')
      )) {
        types.answerColumn = header;
      }
    }

    return types;
  }

  async disconnect(tenantId: string, spreadsheetId: string): Promise<boolean> {
    try {
      await prisma.tenantFile.deleteMany({
        where: {
          tenantId,
          path: spreadsheetId,
          category: 'GOOGLE_SHEET',
        },
      });
      return true;
    } catch (error) {
      console.error('Error disconnecting Google Sheets:', error);
      return false;
    }
  }

  async listConnections(tenantId: string): Promise<any[]> {
    try {
      const connections = await prisma.tenantFile.findMany({
        where: {
          tenantId,
          category: 'GOOGLE_SHEET',
        },
        select: {
          id: true,
          name: true,
          path: true,
          createdAt: true,
          updatedAt: true,
          metadata: true,
        },
      });

      return connections.map((conn) => ({
        id: conn.id,
        title: conn.name,
        spreadsheetId: conn.path,
        connectedAt: (conn.metadata as any)?.connectedAt || conn.createdAt,
        updatedAt: conn.updatedAt,
      }));
    } catch (error) {
      console.error('Error listing Google Sheets connections:', error);
      return [];
    }
  }

  async syncKnowledgeBaseToAgent(tenantId: string, spreadsheetId: string, agentId: string): Promise<boolean> {
    try {
      const connection = await prisma.tenantFile.findFirst({
        where: {
          tenantId,
          path: spreadsheetId,
          category: 'GOOGLE_SHEET',
        },
      });

      if (!connection || !(connection.metadata as any)?.knowledgeBase) {
        // Generate knowledge base if not exists
        await this.generateKnowledgeBase(tenantId, spreadsheetId);
      }

      const updatedConnection = await prisma.tenantFile.findFirst({
        where: {
          tenantId,
          path: spreadsheetId,
          category: 'GOOGLE_SHEET',
        },
      });

      if (!updatedConnection || !(updatedConnection.metadata as any)?.knowledgeBase) {
        throw new Error('Could not generate knowledge base');
      }

      // Update the WhatsApp agent's knowledge base
      await prisma.whatsAppConfig.update({
        where: {
          id: agentId,
          tenantId,
        },
        data: {
          knowledgeBase: (updatedConnection.metadata as any).knowledgeBase,
        },
      });

      return true;
    } catch (error) {
      console.error('Error syncing knowledge base to agent:', error);
      return false;
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
