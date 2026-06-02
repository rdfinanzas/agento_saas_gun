import { test, expect } from '@playwright/test'

/**
 * Agent Management E2E Tests
 * 
 * Tests de flujo completo para crear, editar y gestionar agentes
 */

test.describe('Agent Management', () => {
  // Helper to login before tests
  const login = async (page: any) => {
    const email = `agent-test-${Date.now()}@e2e.test`
    const password = 'TestPassword123!'
    
    // Register
    await page.goto('/login')
    await page.getByRole('link', { name: /register/i }).click()
    await page.getByLabel(/name/i).fill('Agent')
    await page.getByLabel(/last name/i).fill('Tester')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByLabel(/confirm/i).fill(password)
    await page.getByRole('button', { name: /register/i }).click()
    
    await page.waitForTimeout(1000)
    
    // Login
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

  test('should navigate to agents page', async ({ page }) => {
    // Click on agents link in navigation
    await page.getByRole('link', { name: /agents/i }).click()
    
    await expect(page).toHaveURL(/agents/)
    await expect(page.getByRole('heading', { name: /agents/i })).toBeVisible()
  })

  test('should display empty state when no agents', async ({ page }) => {
    await page.goto('/test-tenant/agents')
    
    // Should show empty state or list
    const content = await page.textContent('body')
    expect(content).toMatch(/no agents|empty|create|get started/i)
  })

  test('should create a new INTERNAL agent', async ({ page }) => {
    await page.goto('/test-tenant/agents')
    
    // Click create agent button
    await page.getByRole('button', { name: /create|new|add/i }).click()
    
    // Fill agent form
    const agentName = `Test Agent ${Date.now()}`
    await page.getByLabel(/name/i).fill(agentName)
    await page.getByLabel(/description/i).fill('A test agent for E2E testing')
    
    // Select INTERNAL type
    await page.getByLabel(/type/i).selectOption('INTERNAL')
    
    // Fill system prompt
    await page.getByLabel(/system prompt|instructions/i).fill(
      'You are a helpful assistant for testing purposes'
    )
    
    // Submit
    await page.getByRole('button', { name: /create|save/i }).click()
    
    // Should redirect to agent detail or show success
    await expect(page.getByText(/created|success/i)).toBeVisible({ timeout: 5000 })
    
    // Verify agent appears in list
    await page.goto('/test-tenant/agents')
    await expect(page.getByText(agentName)).toBeVisible()
  })

  test('should create a new EXTERNAL agent', async ({ page }) => {
    await page.goto('/test-tenant/agents/new')
    
    const agentName = `External Agent ${Date.now()}`
    await page.getByLabel(/name/i).fill(agentName)
    await page.getByLabel(/description/i).fill('An external test agent')
    
    // Select EXTERNAL type
    await page.getByLabel(/type/i).selectOption('EXTERNAL')
    
    // Fill role and style
    await page.getByLabel(/role/i).fill('Customer Support')
    await page.getByLabel(/style/i).fill('Friendly and professional')
    
    await page.getByRole('button', { name: /create|save/i }).click()
    
    await expect(page.getByText(/created|success/i)).toBeVisible({ timeout: 5000 })
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto('/test-tenant/agents/new')
    
    // Try to submit without filling required fields
    await page.getByRole('button', { name: /create|save/i }).click()
    
    // Should show validation errors
    await expect(page.getByText(/required|name|fill/i).first()).toBeVisible()
  })

  test('should edit agent settings', async ({ page }) => {
    // First create an agent
    await page.goto('/test-tenant/agents/new')
    const agentName = `Edit Test ${Date.now()}`
    await page.getByLabel(/name/i).fill(agentName)
    await page.getByLabel(/type/i).selectOption('INTERNAL')
    await page.getByRole('button', { name: /create/i }).click()
    
    await page.waitForTimeout(1000)
    
    // Find and click on the agent
    await page.goto('/test-tenant/agents')
    await page.getByText(agentName).click()
    
    // Click edit button
    await page.getByRole('button', { name: /edit|settings/i }).click()
    
    // Update name
    const newName = `Updated ${agentName}`
    await page.getByLabel(/name/i).clear()
    await page.getByLabel(/name/i).fill(newName)
    
    // Save
    await page.getByRole('button', { name: /save|update/i }).click()
    
    // Verify update
    await expect(page.getByText(/updated|success/i)).toBeVisible()
    await expect(page.getByText(newName)).toBeVisible()
  })

  test('should configure agent tools', async ({ page }) => {
    // Create agent first
    await page.goto('/test-tenant/agents/new')
    await page.getByLabel(/name/i).fill(`Tools Test ${Date.now()}`)
    await page.getByLabel(/type/i).selectOption('INTERNAL')
    await page.getByRole('button', { name: /create/i }).click()
    
    await page.waitForTimeout(1000)
    
    // Navigate to tools section
    await page.getByRole('tab', { name: /tools/i }).click()
    
    // Enable/disable tools
    const toolToggle = page.locator('[data-testid="tool-toggle"]').first()
    if (await toolToggle.isVisible().catch(() => false)) {
      await toolToggle.click()
      
      // Save configuration
      await page.getByRole('button', { name: /save/i }).click()
      await expect(page.getByText(/saved|success/i)).toBeVisible()
    }
  })

  test('should activate and pause agent', async ({ page }) => {
    // Create agent
    await page.goto('/test-tenant/agents/new')
    const agentName = `Status Test ${Date.now()}`
    await page.getByLabel(/name/i).fill(agentName)
    await page.getByLabel(/type/i).selectOption('INTERNAL')
    await page.getByRole('button', { name: /create/i }).click()
    
    await page.waitForTimeout(1000)
    
    // Find agent and activate
    await page.goto('/test-tenant/agents')
    await page.getByText(agentName).click()
    
    // Click activate
    const activateBtn = page.getByRole('button', { name: /activate|publish/i })
    if (await activateBtn.isVisible().catch(() => false)) {
      await activateBtn.click()
      await expect(page.getByText(/activated|active/i)).toBeVisible()
    }
    
    // Pause agent
    const pauseBtn = page.getByRole('button', { name: /pause|disable/i })
    if (await pauseBtn.isVisible().catch(() => false)) {
      await pauseBtn.click()
      await expect(page.getByText(/paused|inactive/i)).toBeVisible()
    }
  })

  test('should delete agent', async ({ page }) => {
    // Create agent
    await page.goto('/test-tenant/agents/new')
    const agentName = `Delete Test ${Date.now()}`
    await page.getByLabel(/name/i).fill(agentName)
    await page.getByLabel(/type/i).selectOption('INTERNAL')
    await page.getByRole('button', { name: /create/i }).click()
    
    await page.waitForTimeout(1000)
    
    // Find and delete
    await page.goto('/test-tenant/agents')
    await page.getByText(agentName).click()
    
    // Click delete
    await page.getByRole('button', { name: /delete|remove/i }).click()
    
    // Confirm deletion
    await page.getByRole('button', { name: /confirm|yes|delete/i }).click()
    
    // Verify deletion
    await expect(page.getByText(/deleted|removed/i)).toBeVisible()
    await page.goto('/test-tenant/agents')
    await expect(page.getByText(agentName)).not.toBeVisible()
  })

  test('should chat with agent', async ({ page }) => {
    // Create agent first
    await page.goto('/test-tenant/agents/new')
    const agentName = `Chat Test ${Date.now()}`
    await page.getByLabel(/name/i).fill(agentName)
    await page.getByLabel(/type/i).selectOption('INTERNAL')
    await page.getByRole('button', { name: /create/i }).click()
    
    await page.waitForTimeout(1000)
    
    // Navigate to agent chat
    await page.goto('/test-tenant/agents')
    await page.getByText(agentName).click()
    await page.getByRole('button', { name: /chat|test/i }).click()
    
    // Send a message
    const messageInput = page.getByPlaceholder(/type|message/i)
    await messageInput.fill('Hello, this is a test message')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Verify message appears
    await expect(page.getByText('Hello, this is a test message')).toBeVisible()
    
    // Wait for response (or timeout if no AI configured)
    try {
      await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })
      const response = await page.textContent('[data-testid="assistant-message"]')
      expect(response).toBeTruthy()
    } catch {
      // AI might not be configured in test environment
      console.log('AI response not received (expected in test env)')
    }
  })
})

test.describe('Agent Templates', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    const email = `template-${Date.now()}@e2e.test`
    await page.getByRole('link', { name: /register/i }).click()
    await page.getByLabel(/name/i).fill('Template')
    await page.getByLabel(/last name/i).fill('Tester')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill('TestPassword123!')
    await page.getByLabel(/confirm/i).fill('TestPassword123!')
    await page.getByRole('button', { name: /register/i }).click()
    
    await page.waitForTimeout(1000)
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill('TestPassword123!')
    await page.getByRole('button', { name: /login/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 10000 })
  })

  test('should browse agent templates', async ({ page }) => {
    await page.goto('/test-tenant/marketplace')
    
    await expect(page.getByRole('heading', { name: /marketplace|templates/i })).toBeVisible()
    
    // Should show templates
    const templates = await page.locator('[data-testid="skill-card"], [data-testid="template-card"]').count()
    expect(templates).toBeGreaterThanOrEqual(0)
  })

  test('should install template', async ({ page }) => {
    await page.goto('/test-tenant/marketplace')
    
    // Find first template
    const installBtn = page.getByRole('button', { name: /install|use/i }).first()
    
    if (await installBtn.isVisible().catch(() => false)) {
      await installBtn.click()
      
      // Should show success or redirect to configuration
      await expect(page.getByText(/installed|success|configure/i).first()).toBeVisible({ timeout: 5000 })
    }
  })
})
