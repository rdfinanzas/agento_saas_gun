/**
 * DTOs para configuración de identidad del agente
 */

import {
  IsString, IsOptional, IsBoolean, IsObject, IsArray,
  IsDateString, MaxLength, ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

// Configuración de horarios de atención
export class BusinessHoursDto {
  monday?: { open: string; close: string; closed?: boolean };
  tuesday?: { open: string; close: string; closed?: boolean };
  wednesday?: { open: string; close: string; closed?: boolean };
  thursday?: { open: string; close: string; closed?: boolean };
  friday?: { open: string; close: string; closed?: boolean };
  saturday?: { open: string; close: string; closed?: boolean };
  sunday?: { open: string; close: string; closed?: boolean };
  timezone?: string;
}

// Política individual
export class PolicyDto {
  title: string;
  description: string;
  link?: string;
}

// FAQ individual
export class FaqItemDto {
  question: string;
  answer: string;
  keywords?: string[];
}

// Procedimiento interno
export class ProcedureDto {
  name: string;
  description: string;
  steps?: string[];
  trigger?: string;
}

// DTO principal para actualizar identidad del agente
export class UpdateAgentIdentityDto {
  // Identidad del agente
  @IsOptional()
  @IsString()
  @MaxLength(100)
  agentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  agentRole?: string; // ventas, soporte, atención al cliente, etc.

  @IsOptional()
  @IsString()
  @MaxLength(50)
  agentStyle?: string; // formal, casual, amigable, profesional

  @IsOptional()
  @IsString()
  @MaxLength(10)
  agentLanguage?: string;

  // Información empresarial
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessType?: string; // retail, servicios, tecnología, etc.

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  businessDescription?: string;

  @IsOptional()
  @IsObject()
  businessHours?: BusinessHoursDto;

  @IsOptional()
  @IsArray()
  policies?: PolicyDto[];

  @IsOptional()
  @IsArray()
  procedures?: ProcedureDto[];

  // Conocimiento
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  agentInstructions?: string;

  @IsOptional()
  @IsObject()
  knowledgeBase?: Record<string, any>;

  @IsOptional()
  @IsArray()
  faq?: FaqItemDto[];

  // Modo sandbox
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}

// DTO para crear configuración inicial
export class CreateWhatsAppConfigDto {
  @IsString()
  phoneNumberId: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsString()
  accessToken: string;

  @IsString()
  webhookVerifyToken: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}

// Respuesta con la configuración del agente
export class AgentIdentityResponseDto {
  id: string;
  tenantId: string;

  // Identidad
  agentName: string | null;
  agentRole: string | null;
  agentStyle: string | null;
  agentLanguage: string | null;

  // Empresa
  businessName: string | null;
  businessType: string | null;
  businessDescription: string | null;
  businessHours: BusinessHoursDto | null;
  businessPolicies: PolicyDto[] | null;
  businessProcedures: ProcedureDto[] | null;

  // Conocimiento
  agentInstructions: string | null;
  knowledgeBase: Record<string, any> | null;
  faq: FaqItemDto[] | null;

  // Estado
  isDraft: boolean;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// DTO para modo entrenamiento/sandbox
export class SandboxTestDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  includeContext?: boolean;
}

export class SandboxTestResponseDto {
  response: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  tokensUsed?: number;
  executionTime: number;
}
