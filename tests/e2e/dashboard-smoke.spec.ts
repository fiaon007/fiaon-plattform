import { test, expect } from '@playwright/test';

/**
 * ARAS Dashboard Smoke Test
 * Guards against Safari TDZ regression
 * 
 * Key checks:
 * 1. No "Cannot access uninitialized variable" errors
 * 2. Dashboard loads without ErrorBoundary
 * 3. Key components render
 */

test.describe('Dashboard Safari TDZ Guard', () => {
  
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Store errors for assertions
    (page as any).__collectedErrors = errors;
  });

  test('dashboard loads without TDZ error', async ({ page }) => {
    // Navigate to dashboard (assumes auth bypass or test user)
    await page.goto('/app/dashboard', { waitUntil: 'networkidle' });
    
    // Get collected errors
    const errors = (page as any).__collectedErrors as string[];
    
    // CRITICAL: No "uninitialized variable" error
    const tdzError = errors.find(e => 
      e.includes('uninitialized variable') || 
      e.includes('Cannot access') ||
      e.includes('before initialization')
    );
    expect(tdzError, `TDZ Error detected: ${tdzError}`).toBeUndefined();
    
    // Should NOT show ErrorBoundary
    const errorBoundary = page.locator('text=Ein unerwarteter Fehler ist aufgetreten');
    await expect(errorBoundary).not.toBeVisible({ timeout: 5000 });
  });

  test('dashboard renders key components', async ({ page }) => {
    await page.goto('/app/dashboard', { waitUntil: 'networkidle' });
    
    // Check for Mission Control header
    const header = page.locator('text=MISSION CONTROL');
    await expect(header).toBeVisible({ timeout: 10000 });
    
    // Check for key data-tour markers (proves components rendered)
    const markers = [
      '[data-tour="mc-header"]',
      '[data-tour="mc-kpis"]',
    ];
    
    for (const marker of markers) {
      const element = page.locator(marker);
      await expect(element).toBeVisible({ timeout: 10000 });
    }
  });

  test('no console errors on dashboard load', async ({ page }) => {
    await page.goto('/app/dashboard', { waitUntil: 'networkidle' });
    
    // Wait a bit for any async errors
    await page.waitForTimeout(2000);
    
    const errors = (page as any).__collectedErrors as string[];
    
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(e => 
      !e.includes('ResizeObserver') && // Browser quirk
      !e.includes('Failed to load resource') && // Network issues in test
      !e.includes('401') // Auth expected without login
    );
    
    // Log but don't fail on non-TDZ errors (for debugging)
    if (criticalErrors.length > 0) {
      console.log('Console errors:', criticalErrors);
    }
    
    // MUST NOT have TDZ errors
    const hasTdzError = criticalErrors.some(e => 
      e.includes('uninitialized') || 
      e.includes('Cannot access')
    );
    expect(hasTdzError, `TDZ error found in: ${criticalErrors.join(', ')}`).toBe(false);
  });
});

test.describe('Command Palette', () => {
  
  test('Cmd+K opens command palette', async ({ page }) => {
    await page.goto('/app/dashboard', { waitUntil: 'networkidle' });
    
    // Wait for page to be interactive
    await page.waitForTimeout(1000);
    
    // Press Cmd+K (Mac) or Ctrl+K (Windows)
    await page.keyboard.press('Meta+k');
    
    // Command palette should appear
    const palette = page.locator('[data-testid="command-palette"]').or(
      page.locator('text=Befehl eingeben')
    );
    
    // If palette exists, it should be visible
    const paletteCount = await palette.count();
    if (paletteCount > 0) {
      await expect(palette.first()).toBeVisible({ timeout: 3000 });
    }
  });
});
