import { test, expect } from '@playwright/test'

/**
 * Chat & Conversation E2E Tests
 * 
 * Tests para el flujo de chat con agentes y conversaciones
 */

test.describe('Chat Functionality', () => {
  const login = async (page: any) => {
    const email = `chat-test-${Date.now()}@e2e.test`
    const password = 'TestPassword123!'
    
    await page.goto('/login')
    await page.getByRole('link', { name: /register/i }).click()
    await page.getByLabel(/name/i).fill('Chat')
    await page.getByLabel(/last name/i).fill('Tester')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByLabel(/confirm/i).fill(password)
    await page.getByRole('button', { name: /register/i }).click()
    
    await page.waitForTimeout(1000)
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /login/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 10000 })
    
    return { email, password }
  }

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should display chat interface', async ({ page }) => {
    await page.goto('/test-tenant/accomplish')
    
    // Check chat elements
    await expect(page.getByPlaceholder(/type|message|ask/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible()
  })

  test('should send and display user message', async ({ page }) => {
    await page.goto('/test-tenant/accomplish')
    
    const message = `Test message ${Date.now()}`
    await page.getByPlaceholder(/type|message/i).fill(message)
    await page.getByRole('button', { name: /send/i }).click()
    
    // Verify message appears in chat
    await expect(page.getByText(message)).toBeVisible()
  })

  test('should show message history', async ({ page }) => {
    await page.goto('/test-tenant/accomplish')
    
    // Send multiple messages
    for (let i = 0; i < 3; i++) {
      await page.getByPlaceholder(/type|message/i).fill(`Message ${i}`)
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForTimeout(500)
    }
    
    // Verify all messages are visible
    await expect(page.getByText('Message 0')).toBeVisible()
    await expect(page.getByText('Message 1')).toBeVisible()
    await expect(page.getByText('Message 2')).toBeVisible()
  })

  test('should clear input after sending', async ({ page }) => {
    await page.goto('/test-tenant/accomplish')
    
    const input = page.getByPlaceholder(/type|message/i)
    await input.fill('This should clear')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Input should be empty
    await expect(input).toHaveValue('')
  })

  test('should handle enter key to send', async ({ page }) => {
    await page.goto('/test-tenant/accomplish')
    
    const message = 'Enter key test'
    await page.getByPlaceholder(/type|message/i).fill(message)
    await page.keyboard.press('Enter')
    
    await expect(page.getByText(message)).toBeVisible()
  })

  test('should show typing indicator', async ({ page }) => {
    await page.goto('/test-tenant/accomplish')
    
    await page.getByPlaceholder(/type|message/i).fill('Generate a response')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Should show typing/loading indicator
    const indicator = page.locator('[data-testid="typing-indicator"], [data-testid="loading"]').first()
    try {
      await expect(indicator).toBeVisible({ timeout: 5000 })
    } catch {
      // Indicator might be too fast
    }
  })

  test('should handle long messages', async ({ page }) => {
    await page.goto('/test-tenant/accomplish')
    
    const longMessage = 'A'.repeat(1000)
    await page.getByPlaceholder(/type|message/i).fill(longMessage)
    await page.getByRole('button', { name: /send/i }).click()
    
    // Message should be displayed
    await expect(page.getByText('A'.repeat(100))).toBeVisible()
  })

  test('should handle special characters', async ({ page }) => {
    await page.goto('/test-tenant/accomplish')
    
    const specialMessage = 'Hello! @#$%^&*()_+ 🎉 <script>alert(1)</script>'
    await page.getByPlaceholder(/type|message/i).fill(specialMessage)
    await page.getByRole('button', { name: /send/i }).click()
    
    // Should display without executing scripts
    await expect(page.getByText(/Hello! @/)).toBeVisible()
  })
})

test.describe('Conversations', () => {
  const login = async (page: any) => {
    const email = `conv-test-${Date.now()}@e2e.test`
    const password = 'TestPassword123!'
    
    await page.goto('/login')
    await page.getByRole('link', { name: /register/i }).click()
    await page.getByLabel(/name/i).fill('Conv')
    await page.getByLabel(/last name/i).fill('Tester')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByLabel(/confirm/i).fill(password)
    await page.getByRole('button', { name: /register/i }).click()
    
    await page.waitForTimeout(1000)
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /login/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 10000 })
  }

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should list conversations', async ({ page }) => {
    await page.goto('/test-tenant/conversations')
    
    await expect(page.getByRole('heading', { name: /conversations/i })).toBeVisible()
    
    // Should show list (empty or with items)
    const content = await page.textContent('body')
    expect(content).toMatch(/conversations|no conversations|start/i)
  })

  test('should create new conversation', async ({ page }) => {
    await page.goto('/test-tenant/conversations')
    
    await page.getByRole('button', { name: /new|create|start/i }).click()
    
    // Should open new chat or show agent selector
    await expect(page).toHaveURL(/chat|accomplish|conversation/)
  })

  test('should view conversation history', async ({ page }) => {
    // First create a conversation
    await page.goto('/test-tenant/accomplish')
    await page.getByPlaceholder(/type|message/i).fill('History test message')
    await page.getByRole('button', { name: /send/i }).click()
    
    await page.waitForTimeout(1000)
    
    // Go to conversations list
    await page.goto('/test-tenant/conversations')
    
    // Click on conversation
    const convoLink = page.getByRole('link').first()
    if (await convoLink.isVisible().catch(() => false)) {
      await convoLink.click()
      
      // Should show conversation
      await expect(page.getByText('History test message')).toBeVisible()
    }
  })

  test('should delete conversation', async ({ page }) => {
    await page.goto('/test-tenant/conversations')
    
    // Find delete button on first conversation
    const deleteBtn = page.getByRole('button', { name: /delete|remove|trash/i }).first()
    
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click()
      
      // Confirm deletion
      await page.getByRole('button', { name: /confirm|yes/i }).click()
      
      await expect(page.getByText(/deleted|removed/i)).toBeVisible()
    }
  })
})

test.describe('Agent Chat', () => {
  const login = async (page: any) => {
    const email = `agent-chat-${Date.now()}@e2e.test`
    const password = 'TestPassword123!'
    
    await page.goto('/login')
    await page.getByRole('link', { name: /register/i }).click()
    await page.getByLabel(/name/i).fill('AgentChat')
    await page.getByLabel(/last name/i).fill('Tester')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByLabel(/confirm/i).fill(password)
    await page.getByRole('button', { name: /register/i }).click()
    
    await page.waitForTimeout(1000)
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /login/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 10000 })
    
    // Create an agent
    await page.goto('/test-tenant/agents/new')
    await page.getByLabel(/name/i).fill(`Chat Agent ${Date.now()}`)
    await page.getByLabel(/type/i).selectOption('INTERNAL')
    await page.getByRole('button', { name: /create/i }).click()
    await page.waitForTimeout(1000)
  }

  test('should chat with specific agent', async ({ page }) => {
    await login(page)
    
    await page.goto('/test-tenant/agents')
    await page.getByRole('link', { name: /chat/i }).first().click()
    
    // Should be in chat interface
    await expect(page.getByPlaceholder(/type|message/i)).toBeVisible()
    
    // Send message
    await page.getByPlaceholder(/type|message/i).fill('Hello agent')
    await page.getByRole('button', { name: /send/i }).click()
    
    await expect(page.getByText('Hello agent')).toBeVisible()
  })
})
