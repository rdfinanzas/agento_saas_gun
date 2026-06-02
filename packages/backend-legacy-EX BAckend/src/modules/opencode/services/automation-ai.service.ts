/**
 * AutomationAIService - Servicio para automatizaciones con IA Generativa
 * FASE 4: Automatizaciones con IA Generativa
 */

import { prisma } from '../../../config/database';
import { llmService } from './llm.service';
import type { ProviderType } from '../common/types/provider';

// ============================================
// Interfaces
// ============================================

export interface DailySummaryConfig {
  timeOfDay: string;  // HH:MM format
  recipients: string[];  // Phone numbers or emails
  channels: ('whatsapp' | 'email' | 'dashboard')[];
  format: 'brief' | 'detailed' | 'executive';
  includeMetrics: boolean;
  includeIssues: boolean;
  includePositiveFeedback: boolean;
  customPrompt?: string;
}

export interface SentimentAnalysisResult {
  overall: 'positive' | 'neutral' | 'negative';
  score: number;  // -1 to 1
  confidence: number;  // 0 to 1
  keyPhrases: string[];
  emotions: {
    joy: number;
  anger: number;
  fear: number;
  sadness: number;
  surprise: number;
  };
  issues: string[];
  compliments: string[];
}

export interface FollowUpSuggestion {
  priority: 'high' | 'medium' | 'low';
  reason: string;
  suggestedMessage: string;
  suggestedTiming: Date;
  estimatedImpact: string;
}

export interface IssueDetection {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'product' | 'service' | 'billing' | 'technical' | 'other';
  description: string;
  affectedCustomers: number;
  suggestedActions: string[];
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface ProactiveMessageConfig {
  customerId?: string;
  triggerType: 'inactive' | 'birthday' | 'milestone' | 'sentiment_drop' | 'custom';
  context: Record<string, any>;
  template?: string;
  customPrompt?: string;
}

export interface ProactiveMessageResult {
  message: string;
  channels: string[];
  scheduledFor?: Date;
  estimatedEngagement: number;
}

export interface DailySummaryResult {
  summary: string;
  metrics: {
    conversations: number;
    messages: number;
    newCustomers: number;
    resolvedIssues: number;
    escalatedIssues: number;
  };
  highlights: string[];
  concerns: string[];
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topIssues: Array<{ issue: string; count: number }>;
}

// ============================================
// Rate Limiter para llamadas AI
// ============================================

class AIRateLimiter {
  private calls: Map<string, number[]> = new Map();
  private readonly maxCallsPerMinute = 60;
  private readonly maxCallsPerHour = 1000;

  canMakeCall(tenantId: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    let tenantCalls = this.calls.get(tenantId) || [];
    tenantCalls = tenantCalls.filter(call => call > oneHourAgo);

    const callsInLastMinute = tenantCalls.filter(call => call > oneMinuteAgo).length;
    const callsInLastHour = tenantCalls.length;

    if (callsInLastMinute >= this.maxCallsPerMinute || callsInLastHour >= this.maxCallsPerHour) {
      return false;
    }

    tenantCalls.push(now);
    this.calls.set(tenantId, tenantCalls);
    return true;
  }

  getRemainingCalls(tenantId: string): { perMinute: number; perHour: number } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    const tenantCalls = this.calls.get(tenantId) || [];
    const callsInLastMinute = tenantCalls.filter(call => call > oneMinuteAgo).length;
    const callsInLastHour = tenantCalls.filter(call => call > oneHourAgo).length;

    return {
      perMinute: Math.max(0, this.maxCallsPerMinute - callsInLastMinute),
      perHour: Math.max(0, this.maxCallsPerHour - callsInLastHour),
    };
  }
}

// ============================================
// Servicio Principal
// ============================================

export class AutomationAIService {
  private rateLimiter: AIRateLimiter;
  private defaultProvider: ProviderType = 'anthropic';

  constructor() {
    this.rateLimiter = new AIRateLimiter();
  }

  /**
   * Genera un resumen diario de las conversaciones
   */
  async generateDailySummary(
    tenantId: string,
    config: DailySummaryConfig
  ): Promise<DailySummaryResult> {
    // Check rate limit
    if (!this.rateLimiter.canMakeCall(tenantId)) {
      throw new Error('Rate limit exceeded for AI calls');
    }

    // Get date range for today
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Collect conversation data
    const [conversations, messages] = await Promise.all([
      prisma.conversation.count({
        where: {
          tenantId,
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      prisma.message.count({
        where: {
          tenantId,
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
    ]);

    // Get recent messages for AI analysis
    const recentMessages = await prisma.message.findMany({
      where: {
        tenantId,
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        conversation: {
          select: { phoneNumber: true, contactName: true },
        },
      },
    });

    // Build system prompt based on format
    const systemPrompt = this.buildSummarySystemPrompt(config.format);

    // Build user message with context
    const userMessage = this.buildSummaryUserMessage({
      conversations,
      messages,
      recentMessages: recentMessages.map(m => ({
        from: m.direction,
        content: m.content?.substring(0, 200) || '',
        time: m.createdAt,
      })),
      includeMetrics: config.includeMetrics,
      includeIssues: config.includeIssues,
      includePositiveFeedback: config.includePositiveFeedback,
    });

    // Apply custom prompt if provided
    const finalSystemPrompt = config.customPrompt
      ? `${systemPrompt}\n\nCustom instructions: ${config.customPrompt}`
      : systemPrompt;

    try {
      const response = await llmService.executeRequest({
        provider: this.defaultProvider,
        tenantId,
        systemPrompt: finalSystemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        maxTokens: 2000,
        temperature: 0.7,
      });

      // Parse AI response
      return this.parseSummaryResponse(response.content, {
        conversations,
        messages,
      });
    } catch (error: any) {
      console.error('[AutomationAI] Error generating daily summary:', error);
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  /**
   * Analiza el sentimiento de una conversación
   */
  async analyzeSentiment(
    tenantId: string,
    conversationId: string
  ): Promise<SentimentAnalysisResult> {
    if (!this.rateLimiter.canMakeCall(tenantId)) {
      throw new Error('Rate limit exceeded for AI calls');
    }

    // Get conversation messages
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        tenantId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (messages.length === 0) {
      return {
        overall: 'neutral',
        score: 0,
        confidence: 0,
        keyPhrases: [],
        emotions: { joy: 0, anger: 0, fear: 0, sadness: 0, surprise: 0 },
        issues: [],
        compliments: [],
      };
    }

    // Build conversation text
    const conversationText = messages
      .map(m => `${m.direction}: ${m.content || ''}`)
      .join('\n');

    const systemPrompt = `You are a sentiment analysis expert. Analyze the following customer service conversation and provide:
1. Overall sentiment (positive, neutral, negative)
2. Sentiment score (-1 to 1, where -1 is very negative, 0 is neutral, 1 is very positive)
3. Confidence level (0 to 1)
4. Key phrases that indicate sentiment
5. Emotional breakdown (joy, anger, fear, sadness, surprise as 0-1 values)
6. Any issues mentioned
7. Any compliments or positive feedback

Respond in JSON format.`;

    try {
      const response = await llmService.executeRequest({
        provider: this.defaultProvider,
        tenantId,
        systemPrompt,
        messages: [{ role: 'user', content: conversationText }],
        maxTokens: 1000,
        temperature: 0.3,
      });

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          overall: parsed.overall || 'neutral',
          score: parsed.score || 0,
          confidence: parsed.confidence || 0.5,
          keyPhrases: parsed.keyPhrases || [],
          emotions: parsed.emotions || { joy: 0, anger: 0, fear: 0, sadness: 0, surprise: 0 },
          issues: parsed.issues || [],
          compliments: parsed.compliments || [],
        };
      }

      // Fallback if no JSON found
      return {
        overall: 'neutral',
        score: 0,
        confidence: 0.5,
        keyPhrases: [],
        emotions: { joy: 0, anger: 0, fear: 0, sadness: 0, surprise: 0 },
        issues: [],
        compliments: [],
      };
    } catch (error: any) {
      console.error('[AutomationAI] Error analyzing sentiment:', error);
      throw new Error(`Failed to analyze sentiment: ${error.message}`);
    }
  }

  /**
   * Sugiere acciones de seguimiento para una conversación
   */
  async suggestFollowUp(
    tenantId: string,
    conversationId: string
  ): Promise<FollowUpSuggestion[]> {
    if (!this.rateLimiter.canMakeCall(tenantId)) {
      throw new Error('Rate limit exceeded for AI calls');
    }

    // Get conversation with messages
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const conversationText = conversation.messages
      .map(m => `${m.direction}: ${m.content || ''}`)
      .join('\n');

    const systemPrompt = `You are a customer service expert. Analyze this conversation and suggest follow-up actions.
For each suggestion, provide:
- priority: high/medium/low
- reason: why this follow-up is needed
- suggestedMessage: the exact message to send
- suggestedTiming: when to send (in hours from now, as a number)
- estimatedImpact: brief description of expected impact

Respond as a JSON array of suggestions.`;

    try {
      const response = await llmService.executeRequest({
        provider: this.defaultProvider,
        tenantId,
        systemPrompt,
        messages: [{ role: 'user', content: conversationText }],
        maxTokens: 1500,
        temperature: 0.6,
      });

      // Parse JSON response
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((s: any) => ({
          priority: s.priority || 'medium',
          reason: s.reason || '',
          suggestedMessage: s.suggestedMessage || '',
          suggestedTiming: new Date(Date.now() + (s.suggestedTiming || 24) * 3600000),
          estimatedImpact: s.estimatedImpact || '',
        }));
      }

      return [];
    } catch (error: any) {
      console.error('[AutomationAI] Error suggesting follow-up:', error);
      throw new Error(`Failed to suggest follow-up: ${error.message}`);
    }
  }

  /**
   * Detecta problemas en múltiples conversaciones
   */
  async detectIssues(
    tenantId: string,
    options: {
      lookbackHours?: number;
      minSeverity?: 'critical' | 'high' | 'medium' | 'low';
    } = {}
  ): Promise<IssueDetection[]> {
    if (!this.rateLimiter.canMakeCall(tenantId)) {
      throw new Error('Rate limit exceeded for AI calls');
    }

    const { lookbackHours = 24, minSeverity = 'medium' } = options;

    const cutoffDate = new Date(Date.now() - lookbackHours * 3600000);

    // Get recent conversations with messages
    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        updatedAt: { gte: cutoffDate },
      },
      include: {
        messages: {
          where: { createdAt: { gte: cutoffDate } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      take: 50,
    });

    // Build aggregated text for analysis
    const aggregatedText = conversations
      .map(conv => {
        const messages = conv.messages
          .map(m => `${m.direction}: ${m.content || ''}`)
          .join('\n');
        return `Conversation with ${conv.phoneNumber}:\n${messages}`;
      })
      .join('\n\n---\n\n');

    const systemPrompt = `You are a customer service quality analyst. Analyze these conversations and detect issues.
For each issue found, provide:
- severity: critical/high/medium/low
- category: product/service/billing/technical/other
- description: clear description of the issue
- affectedCustomers: estimated number of customers affected (based on the conversations)
- suggestedActions: array of action items to resolve
- trend: increasing/stable/decreasing (based on frequency in the data)

Only include issues with severity "${minSeverity}" or higher.
Respond as a JSON array of issues.`;

    try {
      const response = await llmService.executeRequest({
        provider: this.defaultProvider,
        tenantId,
        systemPrompt,
        messages: [{ role: 'user', content: aggregatedText }],
        maxTokens: 2000,
        temperature: 0.4,
      });

      // Parse JSON response
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [];
    } catch (error: any) {
      console.error('[AutomationAI] Error detecting issues:', error);
      throw new Error(`Failed to detect issues: ${error.message}`);
    }
  }

  /**
   * Genera un mensaje proactivo para un cliente
   */
  async generateProactiveMessage(
    tenantId: string,
    config: ProactiveMessageConfig
  ): Promise<ProactiveMessageResult> {
    if (!this.rateLimiter.canMakeCall(tenantId)) {
      throw new Error('Rate limit exceeded for AI calls');
    }

    // Get agent identity for context
    const agentConfig = await prisma.whatsAppConfig.findFirst({
      where: { tenantId },
    });

    const businessName = agentConfig?.businessName || 'our company';
    const agentName = agentConfig?.agentName || 'our team';

    let systemPrompt = `You are ${agentName} from ${businessName}. Generate a proactive outreach message.`;
    let userMessage = '';

    switch (config.triggerType) {
      case 'inactive':
        systemPrompt += ` The customer hasn't interacted with us in a while. Create a friendly re-engagement message.`;
        userMessage = `Context: Customer has been inactive. Create a personalized message to re-engage them.`;
        break;

      case 'birthday':
        systemPrompt += ` Today is the customer's birthday. Create a warm birthday message.`;
        userMessage = `Context: Customer's birthday. Create a personalized birthday greeting.`;
        break;

      case 'milestone':
        systemPrompt += ` The customer reached a milestone (purchase anniversary, loyalty tier, etc.). Create a celebration message.`;
        userMessage = `Context: Customer milestone. ${JSON.stringify(config.context)}`;
        break;

      case 'sentiment_drop':
        systemPrompt += ` The customer's recent sentiment has been negative. Create an empathetic message to address their concerns.`;
        userMessage = `Context: Customer sentiment dropped. Create an empathetic reach-out message. ${JSON.stringify(config.context)}`;
        break;

      case 'custom':
        systemPrompt += config.customPrompt || '';
        userMessage = JSON.stringify(config.context);
        break;
    }

    if (config.template) {
      userMessage += `\n\nUse this as a template/guide: ${config.template}`;
    }

    systemPrompt += `\n\nGuidelines:
- Be warm and personalized
- Don't sound robotic or overly promotional
- Keep it concise (under 150 words)
- Include a clear but soft call-to-action
- Respond with just the message text, no explanations`;

    try {
      const response = await llmService.executeRequest({
        provider: this.defaultProvider,
        tenantId,
        systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        maxTokens: 500,
        temperature: 0.8,
      });

      return {
        message: response.content.trim(),
        channels: ['whatsapp'],
        estimatedEngagement: 0.7,
      };
    } catch (error: any) {
      console.error('[AutomationAI] Error generating proactive message:', error);
      throw new Error(`Failed to generate proactive message: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas de uso de AI
   */
  getRateLimitStatus(tenantId: string) {
    return this.rateLimiter.getRemainingCalls(tenantId);
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private buildSummarySystemPrompt(format: 'brief' | 'detailed' | 'executive'): string {
    const basePrompt = `You are an expert business analyst summarizing daily customer service activities for a SaaS platform.`;

    const formatInstructions = {
      brief: 'Provide a concise summary in 3-4 bullet points.',
      detailed: 'Provide a comprehensive summary with metrics, highlights, concerns, and actionable insights.',
      executive: 'Provide a strategic summary focusing on business impact, key metrics, and strategic recommendations.',
    };

    return `${basePrompt} ${formatInstructions[format]}

Your response should be in JSON format with these fields:
- summary: string (the main summary text)
- highlights: string[] (key positive moments)
- concerns: string[] (areas needing attention)
- sentiment: { positive: number, neutral: number, negative: number } (percentage breakdown)
- topIssues: Array<{ issue: string, count: number }> (most mentioned issues)`;
  }

  private buildSummaryUserMessage(data: {
    conversations: number;
    messages: number;
    recentMessages: Array<{ from: string; content: string; time: Date }>;
    includeMetrics: boolean;
    includeIssues: boolean;
    includePositiveFeedback: boolean;
  }): string {
    let message = `Daily Customer Service Summary\n\n`;
    message += `Total conversations: ${data.conversations}\n`;
    message += `Total messages: ${data.messages}\n\n`;

    if (data.recentMessages.length > 0) {
      message += `Recent activity sample:\n`;
      data.recentMessages.slice(0, 20).forEach((msg, i) => {
        message += `${i + 1}. [${msg.from}] ${msg.content}\n`;
      });
    }

    message += `\n\nFocus areas:`;
    if (data.includeMetrics) message += ` metrics`;
    if (data.includeIssues) message += ` issues`;
    if (data.includePositiveFeedback) message += ` positive feedback`;

    return message;
  }

  private parseSummaryResponse(content: string, metrics: {
    conversations: number;
    messages: number;
  }): DailySummaryResult {
    try {
      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || content,
          metrics: {
            conversations: metrics.conversations,
            messages: metrics.messages,
            newCustomers: 0,
            resolvedIssues: 0,
            escalatedIssues: 0,
          },
          highlights: parsed.highlights || [],
          concerns: parsed.concerns || [],
          sentiment: parsed.sentiment || { positive: 33, neutral: 34, negative: 33 },
          topIssues: parsed.topIssues || [],
        };
      }
    } catch (e) {
      // Fallback to plain text
    }

    return {
      summary: content,
      metrics: {
        conversations: metrics.conversations,
        messages: metrics.messages,
        newCustomers: 0,
        resolvedIssues: 0,
        escalatedIssues: 0,
      },
      highlights: [],
      concerns: [],
      sentiment: { positive: 33, neutral: 34, negative: 33 },
      topIssues: [],
    };
  }
}

export const automationAIService = new AutomationAIService();
