/**
 * AgentIdentityService - Servicio para gestión de identidad del agente
 * FASE 3: Configuración de Identidad
 */

import { prisma } from '../../../config/database';
import type { WhatsAppConfig } from '@prisma/client';

// Interfaces
export interface AgentIdentityConfig {
  // Identidad
  agentName?: string;
  agentRole?: string;
  agentStyle?: string;
  agentLanguage?: string;

  // Empresa
  businessName?: string;
  businessType?: string;
  businessDescription?: string;
  businessHours?: BusinessHours;
  businessPolicies?: Policy[];
  businessProcedures?: Procedure[];

  // Conocimiento
  agentInstructions?: string;
  knowledgeBase?: Record<string, any>;
  faq?: FAQ[];

  // Estado
  isDraft?: boolean;
}

export interface BusinessHours {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
  timezone?: string;
}

export interface DaySchedule {
  open?: string;
  close?: string;
  closed?: boolean;
}

export interface Policy {
  title: string;
  description: string;
  link?: string;
}

export interface Procedure {
  name: string;
  description: string;
  steps?: string[];
  trigger?: string;
}

export interface FAQ {
  question: string;
  answer: string;
  keywords?: string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  completeness: number; // 0-100
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export class AgentIdentityService {
  /**
   * Obtiene la configuración de identidad de un agente
   */
  async getIdentity(tenantId: string): Promise<WhatsAppConfig | null> {
    return prisma.whatsAppConfig.findFirst({
      where: { tenantId },
    });
  }

  /**
   * Configura la identidad del agente
   */
  async configureIdentity(
    tenantId: string,
    config: AgentIdentityConfig
  ): Promise<WhatsAppConfig> {
    const existing = await this.getIdentity(tenantId);

    if (!existing) {
      throw new Error('No existe configuración de WhatsApp para este tenant');
    }

    // Actualizar configuración
    const updated = await prisma.whatsAppConfig.update({
      where: { id: existing.id },
      data: {
        agentName: config.agentName,
        agentRole: config.agentRole,
        agentStyle: config.agentStyle,
        agentLanguage: config.agentLanguage,
        businessName: config.businessName,
        businessType: config.businessType,
        businessDescription: config.businessDescription,
        businessHours: config.businessHours as any,
        businessPolicies: config.businessPolicies as any,
        businessProcedures: config.businessProcedures as any,
        agentInstructions: config.agentInstructions,
        knowledgeBase: config.knowledgeBase as any,
        faq: config.faq as any,
        isDraft: config.isDraft,
      },
    });

    return updated;
  }

  /**
   * Valida si el agente está listo para producción
   */
  async validateForProduction(tenantId: string): Promise<ValidationResult> {
    const config = await this.getIdentity(tenantId);

    if (!config) {
      return {
        valid: false,
        issues: [{ field: 'config', message: 'No hay configuración', severity: 'error' }],
        completeness: 0,
      };
    }

    const issues: ValidationIssue[] = [];
    let filledFields = 0;
    const totalFields = 12; // Campos importantes

    // Validar campos requeridos
    if (!config.agentName) {
      issues.push({ field: 'agentName', message: 'Nombre del agente requerido', severity: 'error' });
    } else {
      filledFields++;
    }

    if (!config.agentRole) {
      issues.push({ field: 'agentRole', message: 'Rol del agente recomendado', severity: 'warning' });
    } else {
      filledFields++;
    }

    if (!config.businessName) {
      issues.push({ field: 'businessName', message: 'Nombre de empresa requerido', severity: 'error' });
    } else {
      filledFields++;
    }

    if (!config.businessDescription) {
      issues.push({ field: 'businessDescription', message: 'Descripción de empresa recomendada', severity: 'warning' });
    } else {
      filledFields++;
    }

    if (!config.businessHours) {
      issues.push({ field: 'businessHours', message: 'Horarios de atención recomendados', severity: 'warning' });
    } else {
      filledFields++;
    }

    if (!config.businessPolicies) {
      issues.push({ field: 'businessPolicies', message: 'Políticas no configuradas', severity: 'info' });
    } else {
      filledFields++;
    }

    if (!config.faq || (Array.isArray(config.faq) && config.faq.length === 0)) {
      issues.push({ field: 'faq', message: 'FAQs no configuradas', severity: 'info' });
    } else {
      filledFields++;
    }

    if (!config.agentInstructions) {
      issues.push({ field: 'agentInstructions', message: 'Instrucciones personalizadas recomendadas', severity: 'warning' });
    } else {
      filledFields++;
    }

    if (!config.agentStyle) {
      issues.push({ field: 'agentStyle', message: 'Estilo de comunicación recomendado', severity: 'info' });
    } else {
      filledFields++;
    }

    if (!config.agentLanguage) {
      issues.push({ field: 'agentLanguage', message: 'Idioma no configurado, usando español por defecto', severity: 'info' });
      filledFields++; // Tiene default
    } else {
      filledFields++;
    }

    // Verificar que no esté en modo draft
    if (config.isDraft) {
      issues.push({ field: 'isDraft', message: 'El agente está en modo sandbox', severity: 'warning' });
    }
    filledFields++;

    // Verificar que tenga API key configurada
    const hasApiKey = await this.hasApiKeyConfigured(tenantId);
    if (!hasApiKey) {
      issues.push({ field: 'apiKey', message: 'No hay API key de AI configurada', severity: 'error' });
    } else {
      filledFields++;
    }

    const completeness = Math.round((filledFields / totalFields) * 100);
    const hasErrors = issues.some(i => i.severity === 'error');

    return {
      valid: !hasErrors && completeness >= 50,
      issues,
      completeness,
    };
  }

  /**
   * Verifica si hay API key configurada
   */
  private async hasApiKeyConfigured(tenantId: string): Promise<boolean> {
    // Esta verificación se conecta con el SecureStorage
    // Por ahora, retornamos true si hay configuración activa
    const config = await this.getIdentity(tenantId);
    return config?.isActive ?? false;
  }

  /**
   * Genera el system prompt basado en la configuración
   */
  generateSystemPrompt(config: WhatsAppConfig): string {
    const parts: string[] = [];

    // Identidad del agente
    if (config.agentName) {
      parts.push(`Tu nombre es ${config.agentName}.`);
    } else {
      parts.push('Eres un asistente virtual.');
    }

    if (config.agentRole) {
      parts.push(`Tu rol es: ${config.agentRole}.`);
    }

    if (config.agentStyle) {
      parts.push(`Estilo de comunicación: ${config.agentStyle}.`);
    } else {
      parts.push('Estilo de comunicación: profesional y amigable.');
    }

    if (config.agentLanguage) {
      const langName = config.agentLanguage === 'es' ? 'español' : config.agentLanguage;
      parts.push(`Responde siempre en ${langName}.`);
    } else {
      parts.push('Responde siempre en español.');
    }

    // Información empresarial
    if (config.businessName) {
      parts.push(`\nRepresentas a ${config.businessName}.`);
    }

    if (config.businessType) {
      parts.push(`Tipo de negocio: ${config.businessType}.`);
    }

    if (config.businessDescription) {
      parts.push(`\nDescripción del negocio:\n${config.businessDescription}`);
    }

    // Horarios
    if (config.businessHours) {
      const hours = config.businessHours as any;
      const hoursStr = this.formatBusinessHours(hours);
      if (hoursStr) {
        parts.push(`\nHorarios de atención:\n${hoursStr}`);
        if (hours.timezone) {
          parts.push(`Zona horaria: ${hours.timezone}`);
        }
      }
    }

    // Políticas
    if (config.businessPolicies) {
      const policies = config.businessPolicies as unknown as Policy[];
      if (Array.isArray(policies) && policies.length > 0) {
        parts.push('\nPolíticas:');
        policies.forEach(p => {
          parts.push(`- ${p.title}: ${p.description}`);
        });
      }
    }

    // Procedimientos
    if (config.businessProcedures) {
      const procedures = config.businessProcedures as unknown as Procedure[];
      if (Array.isArray(procedures) && procedures.length > 0) {
        parts.push('\nProcedimientos:');
        procedures.forEach(p => {
          parts.push(`- ${p.name}: ${p.description}`);
        });
      }
    }

    // FAQs
    if (config.faq) {
      const faqs = config.faq as unknown as FAQ[];
      if (Array.isArray(faqs) && faqs.length > 0) {
        parts.push('\nPreguntas frecuentes:');
        faqs.forEach(f => {
          parts.push(`P: ${f.question}`);
          parts.push(`R: ${f.answer}`);
        });
      }
    }

    // Instrucciones personalizadas
    if (config.agentInstructions) {
      parts.push(`\nInstrucciones adicionales:\n${config.agentInstructions}`);
    }

    // Instrucciones de comportamiento
    parts.push('\n\nInstrucciones de comportamiento:');
    parts.push('- Sé amable y profesional en todo momento.');
    parts.push('- Si no conoces la respuesta, indícalo honestamente.');
    parts.push('- No inventes información sobre productos o servicios.');
    parts.push('- Si el cliente necesita ayuda urgente, ofrece alternativas de contacto.');
    parts.push('- Mantén las respuestas concisas pero completas.');

    return parts.join('\n');
  }

  /**
   * Formatea horarios de atención
   */
  private formatBusinessHours(hours: any): string {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames: Record<string, string> = {
      monday: 'Lunes',
      tuesday: 'Martes',
      wednesday: 'Miércoles',
      thursday: 'Jueves',
      friday: 'Viernes',
      saturday: 'Sábado',
      sunday: 'Domingo',
    };

    const lines: string[] = [];

    for (const day of days) {
      if (hours[day]) {
        const schedule = hours[day];
        if (schedule.closed) {
          lines.push(`${dayNames[day]}: Cerrado`);
        } else if (schedule.open && schedule.close) {
          lines.push(`${dayNames[day]}: ${schedule.open} - ${schedule.close}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Activa el agente (sale de modo sandbox)
   */
  async activateAgent(tenantId: string): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateForProduction(tenantId);

    if (!validation.valid) {
      const errors = validation.issues
        .filter(i => i.severity === 'error')
        .map(i => i.message)
        .join(', ');

      return {
        success: false,
        message: `No se puede activar: ${errors}`,
      };
    }

    const config = await this.getIdentity(tenantId);
    if (!config) {
      return { success: false, message: 'No hay configuración' };
    }

    await prisma.whatsAppConfig.update({
      where: { id: config.id },
      data: { isDraft: false },
    });

    return {
      success: true,
      message: 'Agente activado. Ahora responderá a clientes reales.',
    };
  }

  /**
   * Pone el agente en modo sandbox
   */
  async deactivateAgent(tenantId: string): Promise<{ success: boolean; message: string }> {
    const config = await this.getIdentity(tenantId);

    if (!config) {
      return { success: false, message: 'No hay configuración' };
    }

    await prisma.whatsAppConfig.update({
      where: { id: config.id },
      data: { isDraft: true },
    });

    return {
      success: true,
      message: 'Agente en modo sandbox. No responderá a clientes reales.',
    };
  }

  /**
   * Obtiene templates de identidad predefinidos
   */
  getIdentityTemplates(): Record<string, AgentIdentityConfig> {
    return {
      retail: {
        agentRole: 'ventas',
        agentStyle: 'amigable',
        businessType: 'retail',
        businessHours: {
          monday: { open: '09:00', close: '18:00' },
          tuesday: { open: '09:00', close: '18:00' },
          wednesday: { open: '09:00', close: '18:00' },
          thursday: { open: '09:00', close: '18:00' },
          friday: { open: '09:00', close: '18:00' },
          saturday: { open: '10:00', close: '14:00' },
          sunday: { closed: true },
        },
        businessPolicies: [
          { title: 'Devoluciones', description: '30 días para devoluciones con factura' },
          { title: 'Envíos', description: 'Gratis en compras mayores a $50' },
        ],
      },
      servicios: {
        agentRole: 'atención al cliente',
        agentStyle: 'profesional',
        businessType: 'servicios',
        businessHours: {
          monday: { open: '08:00', close: '17:00' },
          tuesday: { open: '08:00', close: '17:00' },
          wednesday: { open: '08:00', close: '17:00' },
          thursday: { open: '08:00', close: '17:00' },
          friday: { open: '08:00', close: '17:00' },
          saturday: { closed: true },
          sunday: { closed: true },
        },
      },
      soporte: {
        agentRole: 'soporte técnico',
        agentStyle: 'formal',
        businessType: 'tecnología',
        agentInstructions: 'Prioriza resolver problemas técnicos. Si el problema es complejo, ofrece escalar a un especialista.',
      },
    };
  }
}

export const agentIdentityService = new AgentIdentityService();
