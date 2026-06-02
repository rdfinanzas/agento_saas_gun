/**
 * WhatsApp Send Tool
 * 
 * SP-4.4: Tool para enviar mensajes por WhatsApp
 * 
 * Features:
 * - Envía mensajes de texto
 * - Soporte para media (URL)
 * - Usa el chat.service existente
 * - Requiere que el tenant tenga WhatsApp configurado
 */

import { z } from "zod"

export const whatsappSendSchema = z.object({
  phone: z.string().regex(/^\+[0-9]{10,15}$/, "Número debe incluir código de país, ej: +541112345678")
    .describe("Número de teléfono con código de país"),
  message: z.string().min(1).max(4096).describe("Mensaje a enviar"),
  mediaUrl: z.string().url().optional().describe("URL de imagen/documento (opcional)"),
})

export type WhatsappSendInput = z.infer<typeof whatsappSendSchema>

export interface WhatsappSendOutput {
  success: boolean
  messageId?: string
  status: string
}

/**
 * Envía un mensaje por WhatsApp
 * 
 * @requiresApproval true - Esta tool requiere aprobación del usuario
 */
export async function executeWhatsappSend(
  params: WhatsappSendInput,
  context: { tenantId: string }
): Promise<WhatsappSendOutput> {
  const { phone, message, mediaUrl } = params
  const { tenantId } = context

  try {
    // Importar dinámicamente para evitar dependencia circular
    const { chatService } = await import("@/modules/chat/services/chat.service")

    // Verificar que el tenant tiene WhatsApp configurado
    const hasConfig = await chatService.hasWhatsAppConfig(tenantId)
    if (!hasConfig) {
      throw new Error("WhatsApp no está configurado para este tenant")
    }

    // Enviar mensaje
    const result = await chatService.sendMessage({
      tenantId,
      phoneNumber: phone,
      content: message,
      type: mediaUrl ? "media" : "text",
      mediaUrl,
    })

    return {
      success: true,
      messageId: result.id,
      status: "sent",
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`WhatsApp send failed: ${error.message}`)
    }
    throw error
  }
}

export const whatsappSendTool = {
  name: "whatsapp_send",
  description: "Envía mensajes por WhatsApp a números de teléfono. Requiere que el tenant tenga WhatsApp Business API configurado.",
  requiresApproval: true,
  schema: whatsappSendSchema,
  execute: executeWhatsappSend,
}
