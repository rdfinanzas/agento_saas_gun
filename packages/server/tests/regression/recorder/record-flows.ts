// Flow definitions for recording user interactions
import { Page } from "playwright"
import { TrafficRecorder } from "./traffic-recorder"

/**
 * Define user flows to record
 * Each flow simulates a real user interaction with the frontend
 */

export interface UserFlow {
  name: string
  description: string
  flow: (page: Page, recorder: TrafficRecorder) => Promise<void>
}

// ========================================
// AUTHENTICATION FLOWS
// ========================================

export const loginFlow: UserFlow = {
  name: "login",
  description: "User login flow",
  flow: async (page, recorder) => {
    // Navigate to login page
    await page.goto("/login")

    // Fill login form
    await page.fill('input[name="email"]', "test@example.com")
    await page.fill('input[name="password"]', "TestPassword123!")

    // Submit form
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard")
  },
}

export const registerFlow: UserFlow = {
  name: "register",
  description: "User registration flow",
  flow: async (page, recorder) => {
    await page.goto("/login")
    await page.click('a:has-text("Crear cuenta")')
    await page.fill('input[name="email"]', "newuser@example.com")
    await page.fill('input[name="password"]', "NewPassword123!")
    await page.fill('input[name="name"]', "New User")
    await page.click('button[type="submit"]')
    await page.waitForURL("**/dashboard")
  },
}

// ========================================
// AGENTS FLOWS
// ========================================

export const listAgentsFlow: UserFlow = {
  name: "agents-list",
  description: "List all agents",
  flow: async (page, recorder) => {
    await page.goto("/dashboard/agents")
    await page.waitForSelector(".agent-card")
  },
}

export const createAgentFlow: UserFlow = {
  name: "agents-create",
  description: "Create a new agent",
  flow: async (page, recorder) => {
    await page.goto("/dashboard/agents")
    await page.click('button:has-text("Nuevo Agente")')
    await page.fill('input[name="name"]', "Test Agent")
    await page.fill('textarea[name="description"]', "Agent for testing purposes")
    await page.click('button[type="submit"]')
    await page.waitForSelector(".agent-created")
  },
}

export const chatWithAgentFlow: UserFlow = {
  name: "agents-chat",
  description: "Chat with an agent",
  flow: async (page, recorder) => {
    await page.goto("/dashboard/agents")
    await page.click(".agent-card:first-child")
    await page.click('button:has-text("Chatear")')
    await page.fill('input[name="message"]', "Hola, ¿cómo estás?")
    await page.click('button[type="submit"]')
    await page.waitForSelector(".message-response")
  },
}

// ========================================
// WHATSAPP FLOWS
// ========================================

export const listWhatsAppConfigsFlow: UserFlow = {
  name: "whatsapp-list",
  description: "List WhatsApp configurations",
  flow: async (page, recorder) => {
    await page.goto("/dashboard/whatsapp")
    await page.waitForSelector(".whatsapp-config-card")
  },
}

export const createWhatsAppConfigFlow: UserFlow = {
  name: "whatsapp-create",
  description: "Create WhatsApp configuration",
  flow: async (page, recorder) => {
    await page.goto("/dashboard/whatsapp")
    await page.click('button:has-text("Nueva Configuración")')
    await page.fill('input[name="phoneNumberId"]', "123456789012345")
    await page.fill('input[name="accessToken"]', "test-access-token")
    await page.click('button[type="submit"]')
  },
}

// ========================================
// BILLING FLOWS
// ========================================

export const viewBillingFlow: UserFlow = {
  name: "billing-view",
  description: "View billing information",
  flow: async (page, recorder) => {
    await page.goto("/dashboard/billing")
    await page.waitForSelector(".billing-info")
  },
}

export const changePlanFlow: UserFlow = {
  name: "billing-change-plan",
  description: "Change subscription plan",
  flow: async (page, recorder) => {
    await page.goto("/dashboard/billing")
    await page.click('button:has-text("Cambiar Plan")')
    await page.click('button:has-text("PRO")')
    await page.waitForSelector(".subscription-updated")
  },
}

// ========================================
// INTEGRATIONS FLOWS
// ========================================

export const listIntegrationsFlow: UserFlow = {
  name: "integrations-list",
  description: "List integrations",
  flow: async (page, recorder) => {
    await page.goto("/dashboard/integrations")
    await page.waitForSelector(".integration-card")
  },
}

// ========================================
// KNOWLEDGE FLOWS
// ========================================

export const listKnowledgeFlow: UserFlow = {
  name: "knowledge-list",
  description: "List knowledge entries",
  flow: async (page, recorder) => {
    await page.goto("/dashboard/knowledge")
    await page.waitForSelector(".knowledge-entry")
  },
}

export const createKnowledgeFlow: UserFlow = {
  name: "knowledge-create",
  description: "Create knowledge entry",
  flow: async (page, recorder) => {
    await page.goto("/dashboard/knowledge")
    await page.click('button:has-text("Nuevo Conocimiento")')
    await page.fill('input[name="title"]', "Test Knowledge")
    await page.fill('textarea[name="content"]', "This is a test knowledge entry")
    await page.click('button[type="submit"]')
  },
}

// ========================================
// ALL flows combined
// ========================================

export const allFlows: UserFlow[] = [
  loginFlow,
  registerFlow,
  listAgentsFlow,
  createAgentFlow,
  chatWithAgentFlow,
  listWhatsAppConfigsFlow,
  createWhatsAppConfigFlow,
  viewBillingFlow,
  changePlanFlow,
  listIntegrationsFlow,
  listKnowledgeFlow,
  createKnowledgeFlow,
]
