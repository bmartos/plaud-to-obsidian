import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test('should display recordings from the database', async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('http://localhost:3000/dashboard');

    // Wait for the table to render
    // The page has a loading state, so we wait for the table headers or a specific element indicating it loaded
    await page.waitForSelector('text=Suas Gravações (Plaud Cloud)', { timeout: 10000 });

    // Verify that the empty state is NOT shown
    const emptyState = page.getByText('Nenhuma gravação encontrada para sincronizar.');
    await expect(emptyState).not.toBeVisible();

    // Verify that at least one row of data is present in the table body
    const tableRows = page.locator('tbody tr');
    const rowCount = await tableRows.count();
    
    // We expect more than 0 rows since our DB is populated
    expect(rowCount).toBeGreaterThan(0);

    // Verify that a specific element like 'Sincronizado' or 'Nuvem' badges are rendered, indicating data is parsed
    const statusBadges = page.locator('span:has-text("Sincronizado"), span:has-text("Nuvem")');
    expect(await statusBadges.count()).toBeGreaterThan(0);
  });
});
