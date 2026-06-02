import { prisma } from '../../../config/database';
import { ExcelParserService, KnowledgeBaseData, ParsedExcel } from './excel-parser.service';
import * as fs from 'fs';
import * as path from 'path';

export interface CreateDataSourceInput {
  tenantId: string;
  name: string;
  filePath: string;
  mimeType: string;
  size: number;
}

export interface DataSourceResult {
  id: string;
  name: string;
  path: string;
  category: string;
  size: number;
  parsedSummary?: ParsedExcel['summary'];
  statistics?: {
    totalSheets: number;
    totalRows: number;
    sheetsWithMostRows: { name: string; rows: number }[];
  };
}

export class DataSourceService {
  private excelParser = new ExcelParserService();

  /**
   * Crea una nueva fuente de datos desde un archivo subido
   */
  async createFromFile(input: CreateDataSourceInput): Promise<DataSourceResult> {
    // Validar que el archivo existe
    if (!fs.existsSync(input.filePath)) {
      throw new Error('Archivo no encontrado');
    }

    // Determinar categoría
    let category = 'DOCUMENT';
    if (input.mimeType.includes('sheet') || input.mimeType.includes('excel') || input.mimeType.includes('csv')) {
      category = 'SPREADSHEET';
    }

    // Crear registro en TenantFile
    const file = await prisma.tenantFile.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        path: input.filePath,
        mimeType: input.mimeType,
        size: BigInt(input.size),
        category: category as any
      }
    });

    // Si es un spreadsheet, parsear y obtener estadísticas
    let parsedSummary;
    let statistics;

    if (category === 'SPREADSHEET') {
      try {
        const parsed = await this.excelParser.parse(input.filePath);
        parsedSummary = parsed.summary;
        statistics = this.excelParser.getStatistics(parsed);
      } catch (error) {
        console.error('Error parseando spreadsheet:', error);
      }
    }

    return {
      id: file.id,
      name: file.name,
      path: file.path,
      category: file.category,
      size: Number(file.size),
      parsedSummary,
      statistics
    };
  }

  /**
   * Lista todas las fuentes de datos de un tenant
   */
  async listByTenant(tenantId: string, category?: string): Promise<DataSourceResult[]> {
    const files = await prisma.tenantFile.findMany({
      where: {
        tenantId,
        ...(category && { category: category as any })
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return files.map(file => ({
      id: file.id,
      name: file.name,
      path: file.path,
      category: file.category,
      size: Number(file.size)
    }));
  }

  /**
   * Obtiene una fuente de datos por ID
   */
  async getById(tenantId: string, fileId: string): Promise<DataSourceResult | null> {
    const file = await prisma.tenantFile.findFirst({
      where: {
        id: fileId,
        tenantId
      }
    });

    if (!file) {
      return null;
    }

    return {
      id: file.id,
      name: file.name,
      path: file.path,
      category: file.category,
      size: Number(file.size)
    };
  }

  /**
   * Obtiene el contenido parseado de una fuente de datos
   */
  async getParsedContent(tenantId: string, fileId: string): Promise<ParsedExcel> {
    const file = await this.getById(tenantId, fileId);

    if (!file) {
      throw new Error('Archivo no encontrado');
    }

    if (file.category !== 'SPREADSHEET') {
      throw new Error('El archivo no es un spreadsheet');
    }

    return this.excelParser.parse(file.path);
  }

  /**
   * Genera una knowledge base desde una fuente de datos
   */
  async generateKnowledgeBase(tenantId: string, fileId: string): Promise<KnowledgeBaseData> {
    const file = await this.getById(tenantId, fileId);

    if (!file) {
      throw new Error('Archivo no encontrado');
    }

    if (file.category !== 'SPREADSHEET') {
      throw new Error('El archivo no es un spreadsheet');
    }

    return this.excelParser.generateKnowledgeBase(file.path);
  }

  /**
   * Actualiza la knowledge base de un agente WhatsApp con datos de una fuente
   */
  async updateAgentKnowledge(tenantId: string, fileId: string): Promise<void> {
    // Obtener knowledge base del archivo
    const knowledgeBase = await this.generateKnowledgeBase(tenantId, fileId);

    // Obtener configuración WhatsApp del tenant
    const config = await prisma.whatsAppConfig.findFirst({
      where: { tenantId }
    });

    if (!config) {
      throw new Error('No hay configuración de WhatsApp para este tenant');
    }

    // Mezclar knowledge base existente con la nueva
    const existingKB = (config.knowledgeBase as any) || {};

    const mergedKB = {
      ...existingKB,
      ...knowledgeBase,
      updatedAt: new Date().toISOString()
    };

    // Actualizar configuración
    await prisma.whatsAppConfig.update({
      where: { id: config.id },
      data: {
        knowledgeBase: mergedKB
      }
    });
  }

  /**
   * Elimina una fuente de datos
   */
  async delete(tenantId: string, fileId: string): Promise<void> {
    const file = await this.getById(tenantId, fileId);

    if (!file) {
      throw new Error('Archivo no encontrado');
    }

    // Eliminar archivo físico
    if (fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (error) {
        console.error('Error eliminando archivo físico:', error);
      }
    }

    // Eliminar registro de base de datos
    await prisma.tenantFile.delete({
      where: { id: fileId }
    });
  }

  /**
   * Obtiene estadísticas de uso de fuentes de datos
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    byCategory: Record<string, number>;
    totalSize: number;
  }> {
    const files = await prisma.tenantFile.findMany({
      where: { tenantId }
    });

    const byCategory: Record<string, number> = {};
    let totalSize = 0;

    files.forEach(file => {
      byCategory[file.category] = (byCategory[file.category] || 0) + 1;
      totalSize += Number(file.size);
    });

    return {
      total: files.length,
      byCategory,
      totalSize
    };
  }
}
