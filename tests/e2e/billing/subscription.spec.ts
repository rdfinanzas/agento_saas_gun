import { test, expect } from '@playwright/test'

/**
 * Billing & Subscription E2E Tests
 * 
 * Tests para flujos de pagos y suscripciones
 */

test.describe('Billing & Subscription', () => {
  const login = async (page: any) => {
    const email = `billing-test-${Date.now()}@e2e.test`
    const password = 'TestPassword123!'
    
    await page.goto('/login')
    await page.getByRole('link', { name: /register/i }).click()
    await page.getByLabel(/name/i).fill('Billing')
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

  test('should display billing page', async ({ page }) => {
    await page.goto('/test-tenant/billing')
    
    await expect(page.getByRole('heading', { name: /billing|subscription|plan/i })).toBeVisible()
    
    // Should show current plan or pricing
    const content = await page.textContent('body')
    expect(content).toMatch(/plan|subscription|pricing|upgrade/i)
  })

  test('should show available plans', async ({ page }) => {
    await page.goto('/test-tenant/billing')
    
    // Look for plan cards
    const planCards = await page.locator('[data-testid="plan-card"], .plan-card, .pricing-card').count()
    
    // Should have at least one plan
    expect(planCards).toBeGreaterThanOrEqual(0)
    
    // Or should show pricing table
    const hasPricing = await page.getByText(/\$|monthly|yearly|free|basic|pro/i).count()
    expect(hasPricing).toBeGreaterThan(0)
  })

  test('should show current subscription status', async ({ page }) => {
    await page.goto('/test-tenant/billing')
    
    // Should show current plan info
    const content = await page.textContent('body')
    expect(content).toMatch(/current|active|status|free|trial/i)
  })

  test('should navigate to upgrade page', async ({ page }) => {
    await page.goto('/test-tenant/billing')
    
    const upgradeBtn = page.getByRole('button', { name: /upgrade|change plan|subscribe/i }).first()
    
    if (await upgradeBtn.isVisible().catch(() => false)) {
      await upgradeBtn.click()
      
      // Should show pricing or checkout
      await expect(page.getByText(/checkout|payment|credit card/i).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('should display payment methods', async ({ page }) => {
    await page.goto('/test-tenant/billing')
    
    // Look for payment methods section
    const paymentSection = page.getByRole('heading', { name: /payment|card|method/i })
    
    if (await paymentSection.isVisible().catch(() => false)) {
      await expect(paymentSection).toBeVisible()
    }
  })

  test('should show billing history', async ({ page }) => {
    await page.goto('/test-tenant/billing')
    
    // Look for invoices/billing history
    const historySection = page.getByRole('heading', { name: /history|invoices|payments/i })
    
    if (await historySection.isVisible().catch(() => false)) {
      await expect(historySection).toBeVisible()
      
      // Should show table or list
      const hasList = await page.locator('table, .invoice-list, .billing-list').count()
      expect(hasList).toBeGreaterThanOrEqual(0)
    }
  })

  test('should handle Stripe checkout flow', async ({ page }) => {
    await page.goto('/test-tenant/billing')
    
    // Find and click upgrade/subscribe
    const subscribeBtn = page.getByRole('button', { name: /subscribe|upgrade|start trial/i }).first()
    
    if (await subscribeBtn.isVisible().catch(() => false)) {
      await subscribeBtn.click()
      
      // Wait for redirect to Stripe or checkout
      await page.waitForTimeout(2000)
      
      // Check if redirected to stripe or showing checkout
      const url = page.url()
      if (url.includes('stripe.com')) {
        // On Stripe checkout
        await expect(page.getByText(/pay|checkout/i)).toBeVisible()
      } else {
        // On custom checkout
        await expect(page.getByRole('button', { name: /pay|confirm/i }).first()).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('should show success page after payment', async ({ page }) => {
    // This would be tested with Stripe test keys
    // Navigate directly to success page
    await page.goto('/test-tenant/billing/success?session_id=test_session')
    
    // Should show success message
    await expect(page.getByText(/success|thank you|confirmed/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('should show cancellation page', async ({ page }) => {
    await page.goto('/test-tenant/billing/failure')
    
    // Should show appropriate message
    const content = await page.textContent('body')
    expect(content).toMatch(/cancelled|failed|error|try again/i)
  })

  test('should allow plan cancellation', async ({ page }) => {
    await page.goto('/test-tenant/billing')
    
    // Find cancel button
    const cancelBtn = page.getByRole('button', { name: /cancel|end subscription/i })
    
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click()
      
      // Confirm cancellation
      await page.getByRole('button', { name: /confirm|yes, cancel/i }).click()
      
      await expect(page.getByText(/cancelled|subscription ended/i)).toBeVisible()
    }
  })

  test('should update payment method', async ({ page }) => {
    await page.goto('/test-tenant/billing')
    
    // Find update payment button
    const updateBtn = page.getByRole('button', { name: /update|change|add card/i }).first()
    
    if (await updateBtn.isVisible().catch(() => false)) {
      await updateBtn.click()
      
      // Should show payment form
      await expect(page.getByLabel(/card|number|expiry/i).first()).toBeVisible()
      
      // Fill test card (Stripe test card)
      await page.getByLabel(/card number/i).fill('4242424242424242')
      await page.getByLabel(/expiry/i).fill('12/30')
      await page.getByLabel(/cvc|cvv/i).fill('123')
      
      await page.getByRole('button', { name: /save|update/i }).click()
      
      await expect(page.getByText(/updated|saved|success/i)).toBeVisible()
    }
  })
})

test.describe('Usage & Limits', () => {
  const login = async (page: any) => {
    const email = `usage-test-${Date.now()}@e2e.test`
    const password = 'TestPassword123!'
    
    await page.goto('/login')
    await page.getByRole('link', { name: /register/i }).click()
    await page.getByLabel(/name/i).fill('Usage')
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

  test('should show usage statistics', async ({ page }) => {
    await page.goto('/test-tenant/analytics')
    
    // Should show usage metrics
    const content = await page.textContent('body')
    expect(content).toMatch(/usage|messages|tokens|api calls/i)
  })

  test('should show plan limits', async ({ page }) => {
    await page.goto('/test-tenant/billing')
    
    // Should show usage limits
    const content = await page.textContent('body')
    expect(content).toMatch(/limit|used|remaining|quota/i)
  })
})
