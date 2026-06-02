/**
 * ApiDocsService - Servicio para leer documentación de APIs y generar conectores
 * FASE 6: Integración Agéntica
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../../config/database';

// Interfaces
export interface ApiDocumentation {
  openapi?: string;
  swagger?: string;
  info: ApiInfo;
  servers: ServerObject[];
  paths: Record<string, Record<string, PathItem>>;
  components?: ComponentsObject;
}

export interface ApiInfo {
  title: string;
  description?: string;
  version: string;
  contact?: {
    name?: string;
    email?: string;
  };
}

export interface ServerObject {
  url: string;
  description?: string;
  variables?: Record<string, any>;
}

export interface PathItem {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
  deprecated?: boolean;
}

export interface ParameterObject {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: any;
}

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema?: SchemaObject;
  example?: any;
  examples?: Record<string, any>;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  enum?: string[];
  default?: any;
  example?: any;
  $ref?: string;
}

export interface ComponentsObject {
  schemas?: Record<string, SchemaObject>;
  securitySchemes?: Record<string, SecuritySchemeObject>;
}

export interface SecuritySchemeObject {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
}

export interface ConnectorConfig {
  name: string;
  description?: string;
  baseUrl?: string;
  documentationUrl?: string;
  authType: 'apiKey' | 'bearer' | 'oauth2' | 'basic' | 'none';
  authConfig?: {
    apiKeyName?: string;
    apiKeyIn?: 'header' | 'query';
    apiKeyValue?: string;
    bearerToken?: string;
    username?: string;
    password?: string;
    oauthClientId?: string;
    oauthClientSecret?: string;
    oauthTokenUrl?: string;
  };
  includePaths?: string[];
  excludePaths?: string[];
  includeTags?: string[];
}

export interface GeneratedConnector {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  baseUrl: string;
  authType: 'apiKey' | 'bearer' | 'oauth2' | 'basic' | 'none';
  authConfig?: Record<string, any>;
  tools: GeneratedTool[];
  rawDocumentation?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedTool {
  id: string;
  connectorId: string;
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  parameters: ParameterSchema;
  requestBody?: RequestBodySchema;
  responseSchema: Record<string, any>;
  operationId?: string;
  tags?: string[];
  deprecated: boolean;
}

export interface ParameterSchema {
  path: ParameterDefinition[];
  query: ParameterDefinition[];
  header: ParameterDefinition[];
}

export interface ParameterDefinition {
  name: string;
  type: string;
  format?: string;
  description?: string;
  required: boolean;
  default?: any;
  enum?: string[];
  example?: any;
}

export interface RequestBodySchema {
  contentType: string;
  schema: Record<string, any>;
  required: boolean;
  example?: any;
}

export interface TestResult {
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  duration: number;
}

export class ApiDocsService {
  /**
   * Lee documentación de API desde una URL
   */
  async readDocumentation(url: string): Promise<ApiDocumentation> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error fetching documentation: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      let doc: any;

      if (contentType.includes('application/json') || url.endsWith('.json')) {
        doc = await response.json();
      } else if (contentType.includes('application/yaml') || contentType.includes('text/yaml') || url.endsWith('.yaml') || url.endsWith('.yml')) {
        const text = await response.text();
        doc = this.parseYaml(text);
      } else {
        // Intentar JSON primero, luego YAML
        const text = await response.text();
        try {
          doc = JSON.parse(text);
        } catch {
          doc = this.parseYaml(text);
        }
      }

      // Normalizar a formato OpenAPI
      return this.normalizeDocumentation(doc);
    } catch (error: any) {
      throw new Error(`Error reading API documentation: ${error.message}`);
    }
  }

  /**
   * Genera un conector desde la documentación
   */
  async generateConnector(
    tenantId: string,
    documentation: ApiDocumentation,
    config: ConnectorConfig
  ): Promise<GeneratedConnector> {
    const connectorId = uuidv4();
    const baseUrl = config.baseUrl || documentation.servers?.[0]?.url || '';

    if (!baseUrl) {
      throw new Error('No se pudo determinar la URL base del API');
    }

    // Generar herramientas desde los paths
    const tools: GeneratedTool[] = [];
    const paths = documentation.paths || {};

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, pathItem] of Object.entries(methods as Record<string, PathItem>)) {
        // Filtrar por paths incluidos/excluidos
        if (config.includePaths && config.includePaths.length > 0) {
          if (!config.includePaths.some(p => path.startsWith(p))) {
            continue;
          }
        }

        if (config.excludePaths && config.excludePaths.length > 0) {
          if (config.excludePaths.some(p => path.startsWith(p))) {
            continue;
          }
        }

        // Filtrar por tags
        if (config.includeTags && config.includeTags.length > 0) {
          if (!pathItem.tags?.some(t => config.includeTags!.includes(t))) {
            continue;
          }
        }

        // Solo métodos HTTP válidos
        const validMethods = ['get', 'post', 'put', 'delete', 'patch'];
        if (!validMethods.includes(method.toLowerCase())) {
          continue;
        }

        const tool = this.generateToolFromPathItem(
          connectorId,
          path,
          method.toUpperCase() as GeneratedTool['method'],
          pathItem,
          documentation.components
        );

        tools.push(tool);
      }
    }

    // Crear registro en BD
    const connector = await prisma.apiConnector.create({
      data: {
        id: connectorId,
        tenantId,
        name: config.name,
        description: config.description || documentation.info?.description || '',
        baseUrl,
        authType: config.authType,
        authConfig: config.authConfig as any,
        tools: tools as any,
        rawDocumentation: documentation as any,
        isActive: true,
      },
    });

    return {
      id: connector.id,
      tenantId: connector.tenantId,
      name: connector.name,
      description: connector.description || '',
      baseUrl: connector.baseUrl,
      authType: connector.authType as GeneratedConnector['authType'],
      authConfig: connector.authConfig as Record<string, any>,
      tools,
      rawDocumentation: connector.rawDocumentation as Record<string, any>,
      isActive: connector.isActive,
      createdAt: connector.createdAt,
      updatedAt: connector.updatedAt,
    };
  }

  /**
   * Prueba un conector
   */
  async testConnector(
    tenantId: string,
    connectorId: string,
    toolName: string,
    input: Record<string, any>
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const connector = await prisma.apiConnector.findFirst({
        where: { id: connectorId, tenantId },
      });

      if (!connector) {
        return {
          success: false,
          error: 'Conector no encontrado',
          duration: Date.now() - startTime,
        };
      }

      const tools = connector.tools as unknown as unknown as GeneratedTool[];
      const tool = tools.find(t => t.name === toolName);

      if (!tool) {
        return {
          success: false,
          error: `Herramienta '${toolName}' no encontrada`,
          duration: Date.now() - startTime,
        };
      }

      // Construir URL
      let url = connector.baseUrl + tool.path;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const queryParams: Record<string, string> = {};

      // Agregar autenticación
      const authConfig = connector.authConfig as Record<string, any>;
      switch (connector.authType) {
        case 'apiKey':
          if (authConfig?.apiKeyIn === 'header') {
            headers[authConfig.apiKeyName || 'X-API-Key'] = authConfig.apiKeyValue;
          } else {
            queryParams[authConfig.apiKeyName || 'api_key'] = authConfig.apiKeyValue;
          }
          break;
        case 'bearer':
          headers['Authorization'] = `Bearer ${authConfig?.bearerToken}`;
          break;
        case 'basic':
          const credentials = Buffer.from(
            `${authConfig?.username}:${authConfig?.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
          break;
      }

      // Procesar parámetros
      if (tool.parameters.path) {
        for (const param of tool.parameters.path) {
          if (input[param.name] !== undefined) {
            url = url.replace(`{${param.name}}`, String(input[param.name]));
          }
        }
      }

      if (tool.parameters.query) {
        for (const param of tool.parameters.query) {
          if (input[param.name] !== undefined) {
            queryParams[param.name] = String(input[param.name]);
          }
        }
      }

      if (tool.parameters.header) {
        for (const param of tool.parameters.header) {
          if (input[param.name] !== undefined) {
            headers[param.name] = String(input[param.name]);
          }
        }
      }

      // Agregar query params a URL
      if (Object.keys(queryParams).length > 0) {
        const searchParams = new URLSearchParams(queryParams);
        url += `?${searchParams.toString()}`;
      }

      // Preparar opciones del fetch
      const fetchOptions: RequestInit = {
        method: tool.method,
        headers,
      };

      // Agregar body si es necesario
      if (['POST', 'PUT', 'PATCH'].includes(tool.method) && tool.requestBody && input.body) {
        fetchOptions.body = JSON.stringify(input.body);
      }

      // Ejecutar request
      const response = await fetch(url, fetchOptions);
      const duration = Date.now() - startTime;

      let data: any;
      const responseContentType = response.headers.get('content-type') || '';

      if (responseContentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        success: response.ok,
        status: response.status,
        data,
        duration,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Obtiene todos los conectores de un tenant
   */
  async listConnectors(tenantId: string): Promise<GeneratedConnector[]> {
    const connectors = await prisma.apiConnector.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return connectors.map(c => ({
      id: c.id,
      tenantId: c.tenantId,
      name: c.name,
      description: c.description,
      baseUrl: c.baseUrl,
      authType: c.authType as GeneratedConnector['authType'],
      authConfig: c.authConfig as Record<string, any>,
      tools: c.tools as unknown as GeneratedTool[],
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  /**
   * Obtiene un conector por ID
   */
  async getConnector(tenantId: string, connectorId: string): Promise<GeneratedConnector | null> {
    const connector = await prisma.apiConnector.findFirst({
      where: { id: connectorId, tenantId },
    });

    if (!connector) return null;

    return {
      id: connector.id,
      tenantId: connector.tenantId,
      name: connector.name,
      description: connector.description,
      baseUrl: connector.baseUrl,
      authType: connector.authType as GeneratedConnector['authType'],
      authConfig: connector.authConfig as Record<string, any>,
      tools: connector.tools as unknown as GeneratedTool[],
      isActive: connector.isActive,
      createdAt: connector.createdAt,
      updatedAt: connector.updatedAt,
    };
  }

  /**
   * Actualiza un conector
   */
  async updateConnector(
    tenantId: string,
    connectorId: string,
    updates: Partial<ConnectorConfig>
  ): Promise<GeneratedConnector | null> {
    const connector = await prisma.apiConnector.update({
      where: { id: connectorId },
      data: {
        name: updates.name,
        description: updates.description,
        baseUrl: updates.baseUrl,
        authType: updates.authType,
        authConfig: updates.authConfig as any,
        updatedAt: new Date(),
      },
    });

    return {
      id: connector.id,
      tenantId: connector.tenantId,
      name: connector.name,
      description: connector.description,
      baseUrl: connector.baseUrl,
      authType: connector.authType as GeneratedConnector['authType'],
      authConfig: connector.authConfig as Record<string, any>,
      tools: connector.tools as unknown as GeneratedTool[],
      isActive: connector.isActive,
      createdAt: connector.createdAt,
      updatedAt: connector.updatedAt,
    };
  }

  /**
   * Elimina un conector
   */
  async deleteConnector(tenantId: string, connectorId: string): Promise<void> {
    await prisma.apiConnector.delete({
      where: { id: connectorId },
    });
  }

  /**
   * Habilita/Deshabilita un conector
   */
  async toggleConnector(tenantId: string, connectorId: string, isActive: boolean): Promise<void> {
    await prisma.apiConnector.update({
      where: { id: connectorId },
      data: { isActive, updatedAt: new Date() },
    });
  }

  /**
   * Obtiene las herramientas de un conector
   */
  async getConnectorTools(connectorId: string): Promise<GeneratedTool[]> {
    const connector = await prisma.apiConnector.findUnique({
      where: { id: connectorId },
    });

    if (!connector) {
      return [];
    }

    return connector.tools as unknown as GeneratedTool[];
  }

  /**
   * Ejecuta una herramienta específica de un conector
   */
  async executeTool(
    tenantId: string,
    connectorId: string,
    toolId: string,
    input: Record<string, any>
  ): Promise<TestResult> {
    const connector = await prisma.apiConnector.findFirst({
      where: { id: connectorId, tenantId },
    });

    if (!connector) {
      return {
        success: false,
        error: 'Conector no encontrado',
        duration: 0,
      };
    }

    const tools = connector.tools as unknown as GeneratedTool[];
    const tool = tools.find(t => t.id === toolId);

    if (!tool) {
      return {
        success: false,
        error: `Herramienta con ID '${toolId}' no encontrada`,
        duration: 0,
      };
    }

    return this.testConnector(tenantId, connectorId, tool.name, input);
  }

  // ============================================
  // Métodos privados
  // ============================================

  private parseYaml(text: string): any {
    // Parser YAML simple para documentación OpenAPI
    // Nota: En producción usar una librería como 'js-yaml'
    const lines = text.split('\n');
    const result: any = {};
    let currentPath: any = result;
    const pathStack: any[] = [result];
    const indentStack: number[] = [-1];

    for (const line of lines) {
      const indent = line.search(/\S/);
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) continue;

      // Manejar indentación
      while (indent <= indentStack[indentStack.length - 1]) {
        pathStack.pop();
        indentStack.pop();
      }

      currentPath = pathStack[pathStack.length - 1];

      if (trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        if (value === '' || value === '|' || value === '>') {
          currentPath[key] = {};
          pathStack.push(currentPath[key]);
          indentStack.push(indent);
        } else if (value.startsWith('[') && value.endsWith(']')) {
          currentPath[key] = value
            .substring(1, value.length - 1)
            .split(',')
            .map(s => s.trim().replace(/['"]/g, ''));
        } else if (value.startsWith('"') && value.endsWith('"')) {
          currentPath[key] = value.substring(1, value.length - 1);
        } else if (value === 'true' || value === 'false') {
          currentPath[key] = value === 'true';
        } else if (!isNaN(Number(value))) {
          currentPath[key] = Number(value);
        } else {
          currentPath[key] = value;
        }
      } else if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).trim();
        if (!Array.isArray(currentPath)) {
          const parent = pathStack[pathStack.length - 2];
          const lastKey = Object.keys(parent).find(k => parent[k] === currentPath);
          if (lastKey) {
            parent[lastKey] = [value];
            currentPath = parent[lastKey];
            pathStack[pathStack.length - 1] = currentPath;
          }
        } else {
          currentPath.push(value);
        }
      }
    }

    return result;
  }

  private normalizeDocumentation(doc: any): ApiDocumentation {
    // Si ya es OpenAPI 3.x
    if (doc.openapi) {
      return {
        openapi: doc.openapi,
        info: doc.info || { title: 'API', version: '1.0' },
        servers: doc.servers || [{ url: '' }],
        paths: doc.paths || {},
        components: doc.components,
      };
    }

    // Si es Swagger 2.x, convertir a OpenAPI 3
    if (doc.swagger) {
      return {
        swagger: doc.swagger,
        info: doc.info || { title: 'API', version: '1.0' },
        servers: doc.host ? [{ url: `${doc.schemes?.[0] || 'https'}://${doc.host}${doc.basePath || ''}` }] : [],
        paths: doc.paths || {},
        components: {
          schemas: doc.definitions,
          securitySchemes: doc.securityDefinitions,
        },
      };
    }

    throw new Error('Formato de documentación no reconocido');
  }

  private generateToolFromPathItem(
    connectorId: string,
    path: string,
    method: GeneratedTool['method'],
    pathItem: PathItem,
    components?: ComponentsObject
  ): GeneratedTool {
    const operationId = pathItem.operationId || `${method.toLowerCase()}_${path.replace(/\//g, '_')}`;
    const toolName = this.sanitizeToolName(operationId);

    // Procesar parámetros
    const parameters: ParameterSchema = {
      path: [],
      query: [],
      header: [],
    };

    if (pathItem.parameters) {
      for (const param of pathItem.parameters) {
        const paramDef: ParameterDefinition = {
          name: param.name,
          type: param.schema?.type || 'string',
          format: param.schema?.format,
          description: param.description,
          required: param.required || false,
          default: param.schema?.default,
          enum: param.schema?.enum,
          example: param.example,
        };

        switch (param.in) {
          case 'path':
            parameters.path.push(paramDef);
            break;
          case 'query':
            parameters.query.push(paramDef);
            break;
          case 'header':
            parameters.header.push(paramDef);
            break;
        }
      }
    }

    // Procesar request body
    let requestBody: RequestBodySchema | undefined;
    if (pathItem.requestBody) {
      const content = pathItem.requestBody.content;
      const contentType = Object.keys(content)[0];
      const mediaType = content[contentType];

      requestBody = {
        contentType,
        schema: this.resolveSchema(mediaType.schema, components),
        required: pathItem.requestBody.required || false,
        example: mediaType.example,
      };
    }

    // Procesar responses
    const responseSchema: Record<string, any> = {};
    if (pathItem.responses) {
      for (const [status, response] of Object.entries(pathItem.responses)) {
        const resp = response as ResponseObject;
        if (resp.content) {
          const contentType = Object.keys(resp.content)[0];
          responseSchema[status] = {
            description: resp.description,
            schema: this.resolveSchema(resp.content[contentType].schema, components),
          };
        } else {
          responseSchema[status] = { description: resp.description };
        }
      }
    }

    return {
      id: uuidv4(),
      connectorId,
      name: toolName,
      description: pathItem.summary || pathItem.description || `${method} ${path}`,
      method,
      path,
      parameters,
      requestBody,
      responseSchema,
      operationId,
      tags: pathItem.tags,
      deprecated: pathItem.deprecated || false,
    };
  }

  private sanitizeToolName(operationId: string): string {
    return operationId
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }

  private resolveSchema(
    schema: SchemaObject | undefined,
    components?: ComponentsObject
  ): Record<string, any> {
    if (!schema) return {};

    // Resolver referencias ($ref)
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      if (components?.schemas?.[refName as string]) {
        return this.resolveSchema(components.schemas[refName as string], components);
      }
      return { $ref: schema.$ref };
    }

    const resolved: Record<string, any> = {
      type: schema.type,
      format: schema.format,
      description: schema.description,
      enum: schema.enum,
      default: schema.default,
      example: schema.example,
    };

    if (schema.properties) {
      resolved.properties = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        resolved.properties[key] = this.resolveSchema(value, components);
      }
    }

    if (schema.items) {
      resolved.items = this.resolveSchema(schema.items, components);
    }

    if (schema.required) {
      resolved.required = schema.required;
    }

    return resolved;
  }
}

export const apiDocsService = new ApiDocsService();
