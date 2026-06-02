import { test, expect } from '@playwright/test'

/**
 * Authentication E2E Tests
 * 
 * Tests de flujo completo para autenticación
 */

test.describe('Authentication Flow', () => {
  const testEmail = `test-${Date.now()}@e2e.test`
  const testPassword = 'TestPassword123!'

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('should display login page', async ({ page }) => {
    // Check page title and elements
    await expect(page).toHaveTitle(/Login|AgenTo/)
    await expect(page.getByRole('heading', { name: /login|sign in/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    
    // Click login
    await page.getByRole('button', { name: /login|sign in/i }).click()
    
    // Should show error
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible()
  })

  test('should show validation errors for empty fields', async ({ page }) => {
    // Click login without filling fields
    await page.getByRole('button', { name: /login|sign in/i }).click()
    
    // Should show validation errors
    await expect(page.getByText(/required|email|password/i).first()).toBeVisible()
  })

  test('should navigate to register page', async ({ page }) => {
    // Find and click register link
    const registerLink = page.getByRole('link', { name: /register|sign up|create account/i })
    await registerLink.click()
    
    // Should be on register page
    await expect(page).toHaveURL(/register|signup/)
    await expect(page.getByRole('heading', { name: /register|sign up/i })).toBeVisible()
  })

  test('should complete registration flow', async ({ page }) => {
    // Navigate to register
    await page.goto('/login')
    await page.getByRole('link', { name: /register|sign up/i }).click()
    
    // Fill registration form
    await page.getByLabel(/first name|name/i).fill('Test')
    await page.getByLabel(/last name/i).fill('User')
    await page.getByLabel(/email/i).fill(testEmail)
    await page.getByLabel(/password/i).fill(testPassword)
    await page.getByLabel(/confirm password|repeat password/i).fill(testPassword)
    
    // Submit
    await page.getByRole('button', { name: /register|sign up|create/i }).click()
    
    // Should redirect to login or dashboard
    await expect(page).toHaveURL(/login|dashboard|verify/)
  })

  test('should login with valid credentials', async ({ page }) => {
    // First register
    await page.goto('/login')
    await page.getByRole('link', { name: /register|sign up/i }).click()
    
    const email = `login-test-${Date.now()}@e2e.test`
    await page.getByLabel(/first name|name/i).fill('Login')
    await page.getByLabel(/last name/i).fill('Test')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(testPassword)
    await page.getByLabel(/confirm password/i).fill(testPassword)
    await page.getByRole('button', { name: /register/i }).click()
    
    // Wait for redirect and login
    await page.waitForTimeout(1000)
    await page.goto('/login')
    
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(testPassword)
    await page.getByRole('button', { name: /login/i }).click()
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
  })

  test('should handle forgot password flow', async ({ page }) => {
    // Click forgot password
    await page.getByRole('link', { name: /forgot|reset/i }).click()
    
    // Should be on forgot password page
    await expect(page).toHaveURL(/forgot|reset/)
    await expect(page.getByRole('heading', { name: /forgot|reset/i })).toBeVisible()
    
    // Fill email
    await page.getByLabel(/email/i).fill(testEmail)
    await page.getByRole('button', { name: /send|reset/i }).click()
    
    // Should show confirmation message
    await expect(page.getByText(/sent|email|check/i)).toBeVisible()
  })

  test('should persist session after refresh', async ({ page, context }) => {
    // Login first
    const email = `session-${Date.now()}@e2e.test`
    
    await page.goto('/login')
    await page.getByRole('link', { name: /register/i }).click()
    await page.getByLabel(/name/i).fill('Session')
    await page.getByLabel(/last name/i).fill('Test')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(testPassword)
    await page.getByLabel(/confirm/i).fill(testPassword)
    await page.getByRole('button', { name: /register/i }).click()
    
    await page.waitForTimeout(1000)
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(testPassword)
    await page.getByRole('button', { name: /login/i }).click()
    
    await page.waitForURL(/dashboard/, { timeout: 10000 })
    
    // Refresh page
    await page.reload()
    
    // Should still be logged in (on dashboard)
    await expect(page).toHaveURL(/dashboard/)
  })

  test('should logout successfully', async ({ page }) => {
    // Login first
    const email = `logout-${Date.now()}@e2e.test`
    
    await page.goto('/login')
    await page.getByRole('link', { name: /register/i }).click()
    await page.getByLabel(/name/i).fill('Logout')
    await page.getByLabel(/last name/i).fill('Test')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(testPassword)
    await page.getByLabel(/confirm/i).fill(testPassword)
    await page.getByRole('button', { name: /register/i }).click()
    
    await page.waitForTimeout(1000)
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(testPassword)
    await page.getByRole('button', { name: /login/i }).click()
    
    await page.waitForURL(/dashboard/, { timeout: 10000 })
    
    // Click logout
    await page.getByRole('button', { name: /logout|sign out/i }).click()
    
    // Should redirect to login
    await expect(page).toHaveURL(/login/)
    
    // Try to access protected page
    await page.goto('/dashboard')
    
    // Should redirect back to login
    await expect(page).toHaveURL(/login/)
  })
})

test.describe('Admin Authentication', () => {
  test('should access admin login', async ({ page }) => {
    await page.goto('/admin-login')
    
    await expect(page.getByRole('heading', { name: /admin/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('should require admin credentials', async ({ page }) => {
    await page.goto('/admin-login')
    
    await page.getByLabel(/email/i).fill('user@example.com')
    await page.getByLabel(/password/i).fill('userpassword')
    await page.getByRole('button', { name: /login/i }).click()
    
    // Should show error or redirect
    await expect(page.getByText(/unauthorized|invalid|admin/i).first()).toBeVisible()
  })
})
