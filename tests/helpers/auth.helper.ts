/**
 * Authentication Helper
 * 
 * Utilidades para manejar autenticación en tests E2E
 */

import { Page, expect } from '@playwright/test'

interface UserCredentials {
  email: string
  password: string
  firstName?: string
  lastName?: string
}

/**
 * Registra un nuevo usuario
 */
export async function registerUser(page: Page, user: UserCredentials): Promise<void> {
  await page.goto('/login')
  
  // Click register link
  await page.getByRole('link', { name: /register|sign up/i }).click()
  
  // Fill form
  await page.getByLabel(/first name|name/i).fill(user.firstName || 'Test')
  await page.getByLabel(/last name/i).fill(user.lastName || 'User')
  await page.getByLabel(/email/i).fill(user.email)
  await page.getByLabel(/password/i).fill(user.password)
  await page.getByLabel(/confirm|repeat/i).fill(user.password)
  
  // Submit
  await page.getByRole('button', { name: /register|sign up|create/i }).click()
  
  // Wait for redirect
  await page.waitForURL(/login|dashboard|verify/, { timeout: 10000 })
}

/**
 * Inicia sesión con credenciales
 */
export async function loginUser(page: Page, credentials: { email: string; password: string }): Promise<void> {
  await page.goto('/login')
  
  await page.getByLabel(/email/i).fill(credentials.email)
  await page.getByLabel(/password/i).fill(credentials.password)
  await page.getByRole('button', { name: /login|sign in/i }).click()
  
  // Wait for dashboard
  await page.waitForURL(/dashboard/, { timeout: 10000 })
}

/**
 * Cierra sesión
 */
export async function logoutUser(page: Page): Promise<void> {
  // Click logout button
  const logoutBtn = page.getByRole('button', { name: /logout|sign out/i })
  
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click()
    await page.waitForURL(/login/)
  }
}

/**
 * Verifica que el usuario está autenticado
 */
export async function expectAuthenticated(page: Page): Promise<void> {
  // Should be on dashboard or have logout button
  const url = page.url()
  const hasLogout = await page.getByRole('button', { name: /logout/i }).isVisible().catch(() => false)
  
  expect(url.includes('dashboard') || hasLogout).toBeTruthy()
}

/**
 * Verifica que el usuario NO está autenticado
 */
export async function expectUnauthenticated(page: Page): Promise<void> {
  // Should be on login page
  await expect(page).toHaveURL(/login/)
  await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible()
}

/**
 * Genera un email único para tests
 */
export function generateTestEmail(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@agento.test`
}

/**
 * Setup: Registrar e iniciar sesión en un paso
 */
export async function setupAuthenticatedUser(
  page: Page, 
  userData?: Partial<UserCredentials>
): Promise<UserCredentials> {
  const user: UserCredentials = {
    email: generateTestEmail(),
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    ...userData,
  }
  
  await registerUser(page, user)
  
  // If redirected to login, login
  if (page.url().includes('login')) {
    await loginUser(page, user)
  }
  
  return user
}
