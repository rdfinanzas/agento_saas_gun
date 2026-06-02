/**
 * Ejemplo de uso del Analytics Module - FASE 3.2
 *
 * Este archivo muestra cómo usar el servicio de analytics
 * y probar los endpoints manualmente.
 */

import { AnalyticsService } from '../services/analytics.service';

/**
 * Ejemplo 1: Obtener estadísticas del dashboard
 */
async function exampleDashboardStats() {
  const analyticsService = new AnalyticsService();

  // Reemplaza con un tenantId válido de tu base de datos
  const tenantId = 'your-tenant-id-here';

  try {
    const stats = await analyticsService.getDashboardStats(tenantId);

    console.log('=== DASHBOARD STATS ===');
    console.log('Total Conversations:', stats.overview.totalConversations);
    console.log('Active Conversations:', stats.overview.activeConversations);
    console.log('Total Messages:', stats.overview.totalMessages);
    console.log('Agents Count:', stats.overview.agentsCount);
    console.log('Avg Messages/Conversation:', stats.calculated.avgMessagesPerConversation);
    console.log('Active Rate:', stats.calculated.activeRate, '%');
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Ejemplo 2: Métricas de conversaciones por día
 */
async function exampleConversationMetrics() {
  const analyticsService = new AnalyticsService();
  const tenantId = 'your-tenant-id-here';

  try {
    const metrics = await analyticsService.getConversationMetrics(
      tenantId,
      'day', // agrupar por día
      30     // últimos 30 días
    );

    console.log('=== CONVERSATION METRICS ===');
    console.log('Period:', metrics.period);
    console.log('Total Conversations:', metrics.summary.totalConversations);
    console.log('Total Messages:', metrics.summary.totalMessages);
    console.log('Avg Messages/Conversation:', metrics.summary.avgMessagesPerConversation);
    console.log('By Status:', metrics.summary.byStatus);
    console.log('Timeline (last 7 days):');

    metrics.timeline.slice(-7).forEach(day => {
      console.log(`  ${day.date}: ${day.conversations} conversations, ${day.messages} messages`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Ejemplo 3: Estadísticas de uso
 */
async function exampleUsageStats() {
  const analyticsService = new AnalyticsService();
  const tenantId = 'your-tenant-id-here';

  try {
    const stats = await analyticsService.getUsageStats(tenantId, 30);

    console.log('=== USAGE STATS ===');
    console.log('Period:', stats.period);
    console.log('Total Requests:', stats.totals.requests);
    console.log('Total WhatsApp Messages:', stats.totals.whatsappMessages);
    console.log('Avg Requests/Day:', stats.totals.avgRequestsPerDay);
    console.log('Avg Messages/Day:', stats.totals.avgMessagesPerDay);
    console.log('Peak Day:', stats.peakDay);
    console.log('Trend:', stats.trend);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Ejemplo 4: Performance por agente
 */
async function exampleAgentPerformance() {
  const analyticsService = new AnalyticsService();
  const tenantId = 'your-tenant-id-here';

  try {
    const performance = await analyticsService.getAgentPerformance(tenantId, 30);

    console.log('=== AGENT PERFORMANCE ===');
    console.log('Period:', performance.period);
    console.log('Summary:', performance.summary);

    performance.agents.forEach(agent => {
      console.log(`\nAgent: ${agent.agentId}`);
      console.log(`  Mode: ${agent.agentMode}`);
      console.log(`  Active: ${agent.isActive}`);
      console.log(`  Conversations: ${agent.stats.totalConversations}`);
      console.log(`  Messages: ${agent.stats.totalMessages}`);
      console.log(`  Avg Messages/Conv: ${agent.stats.avgMessagesPerConversation}`);
      console.log(`  By Status:`, agent.byStatus);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Ejemplo 5: Top queries
 */
async function exampleTopQueries() {
  const analyticsService = new AnalyticsService();
  const tenantId = 'your-tenant-id-here';

  try {
    const topQueries = await analyticsService.getTopQueries(tenantId, 10, 30);

    console.log('=== TOP QUERIES ===');
    console.log('Period:', topQueries.period);
    console.log('Total Queries:', topQueries.totalQueries);
    console.log('\nTop 10 Queries:');

    topQueries.topQueries.forEach((q, i) => {
      console.log(`  ${i + 1}. "${q.query}" (${q.count} times)`);
    });

    console.log('\nCategories:', topQueries.categories);
    console.log('\nRecent Messages:');
    topQueries.recentMessages.forEach(msg => {
      console.log(`  ${msg.contact}: ${msg.content}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Ejemplo 6: Métricas de tiempo de respuesta
 */
async function exampleResponseTime() {
  const analyticsService = new AnalyticsService();
  const tenantId = 'your-tenant-id-here';

  try {
    const metrics = await analyticsService.getResponseTimeMetrics(tenantId, 30);

    console.log('=== RESPONSE TIME METRICS ===');
    console.log('Period:', metrics.period);
    console.log('Total Responses:', metrics.totalResponses);
    console.log('\nAverage Response Time:');
    console.log(`  ${metrics.avgResponseTime.ms}ms`);
    console.log(`  ${metrics.avgResponseTime.seconds}s`);
    console.log(`  ${metrics.avgResponseTime.minutes}m`);
    console.log('\nMin Response Time:', metrics.minResponseTime);
    console.log('Max Response Time:', metrics.maxResponseTime);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Ejemplo 7: Analytics completos (todo en una llamada)
 */
async function exampleCompleteAnalytics() {
  const analyticsService = new AnalyticsService();
  const tenantId = 'your-tenant-id-here';

  try {
    const analytics = await analyticsService.getCompleteAnalytics(tenantId, 30);

    console.log('=== COMPLETE ANALYTICS ===');
    console.log('Generated At:', analytics.generatedAt);
    console.log('Period:', analytics.period);

    // Todos los datos están disponibles en:
    // - analytics.dashboard
    // - analytics.conversations
    // - analytics.usage
    // - analytics.agentPerformance
    // - analytics.topQueries

    console.log('\nDashboard Overview:', analytics.dashboard.overview);
    console.log('\nConversation Summary:', analytics.conversations.summary);
    console.log('\nUsage Totals:', analytics.usage.totals);
    console.log('\nAgent Performance Summary:', analytics.agentPerformance.summary);
    console.log('\nTop Queries:', analytics.topQueries.topQueries.slice(0, 5));
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Ejemplo de cómo llamar a los endpoints HTTP
 *
 * Primero necesitas obtener un token JWT válido desde el endpoint de login:
 * POST /api/v1/auth/login
 * {
 *   "email": "user@example.com",
 *   "password": "password",
 *   "tenantSlug": "your-tenant"
 * }
 *
 * Luego usar el token en los headers:
 * Authorization: Bearer <token>
 */
async function exampleHTTPCalls() {
  const API_URL = 'http://localhost:3001/api/v1';
  const TOKEN = 'your-jwt-token-here';

  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Dashboard Stats
    console.log('Fetching dashboard stats...');
    const dashboard = await fetch(`${API_URL}/analytics/dashboard`, { headers });
    const dashboardData = await dashboard.json();
    console.log('Dashboard:', dashboardData);

    // 2. Conversation Metrics
    console.log('\nFetching conversation metrics...');
    const conversations = await fetch(
      `${API_URL}/analytics/conversations?period=day&days=30`,
      { headers }
    );
    const convData = await conversations.json();
    console.log('Conversations:', convData);

    // 3. Usage Stats
    console.log('\nFetching usage stats...');
    const usage = await fetch(
      `${API_URL}/analytics/usage?days=30`,
      { headers }
    );
    const usageData = await usage.json();
    console.log('Usage:', usageData);

    // 4. Agent Performance
    console.log('\nFetching agent performance...');
    const agents = await fetch(
      `${API_URL}/analytics/agents/performance?days=30`,
      { headers }
    );
    const agentsData = await agents.json();
    console.log('Agents:', agentsData);

    // 5. Top Queries
    console.log('\nFetching top queries...');
    const queries = await fetch(
      `${API_URL}/analytics/queries/top?limit=10&days=30`,
      { headers }
    );
    const queriesData = await queries.json();
    console.log('Queries:', queriesData);

    // 6. Response Time
    console.log('\nFetching response time metrics...');
    const responseTime = await fetch(
      `${API_URL}/analytics/response-time?days=30`,
      { headers }
    );
    const responseTimeData = await responseTime.json();
    console.log('Response Time:', responseTimeData);

    // 7. Complete Analytics (all in one call)
    console.log('\nFetching complete analytics...');
    const complete = await fetch(
      `${API_URL}/analytics/complete?days=30`,
      { headers }
    );
    const completeData = await complete.json();
    console.log('Complete Analytics:', completeData);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Exportar ejemplos para uso en tests
export {
  exampleDashboardStats,
  exampleConversationMetrics,
  exampleUsageStats,
  exampleAgentPerformance,
  exampleTopQueries,
  exampleResponseTime,
  exampleCompleteAnalytics,
  exampleHTTPCalls
};

// Ejecutar ejemplos si se ejecuta directamente
if (require.main === module) {
  console.log('Ejecutando ejemplos de Analytics...\n');

  // Descomentar el ejemplo que quieras ejecutar
  // exampleDashboardStats();
  // exampleConversationMetrics();
  // exampleUsageStats();
  // exampleAgentPerformance();
  // exampleTopQueries();
  // exampleResponseTime();
  // exampleCompleteAnalytics();
  // exampleHTTPCalls();
}
