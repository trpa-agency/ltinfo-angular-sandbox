// What a visitor sees: staff mode off. No control that writes to the database, no layout
// column or filter, no connection footer; a page title that names the program; and a skip
// link that moves focus past the header and nav.
import { expect, seed, test } from './support';

test.use({ staff: false });

test.describe('A visitor', () => {
  test('sees no staff controls on a program page, and the title names the program', async ({ page }) => {
    await page.goto(`/programs/${seed.ozone.id}`);
    await expect(page.getByRole('heading', { level: 1, name: seed.ozone.name })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`^${seed.ozone.name.replace(/[()]/g, '\$&')} \| Monitoring Dashboard`));
    await expect(page.locator('app-layout-control')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Save layout|Mark as featured|Remove from featured/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Program Settings' })).toHaveCount(0);
    await expect(page.locator('.app-footer')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'All Programs' }).first()).toBeVisible();
  });

  test('sees no layout column or filter in the All Programs list', async ({ page }) => {
    await page.goto('/#all-programs');
    await expect(page.locator('table.programs-table tbody tr')).toHaveCount(seed.programs);
    await expect(page.locator('table.programs-table thead th')).toHaveText(['Program', 'Category', 'Partners', 'Featured']);
    await expect(page.getByLabel('Layout')).toHaveCount(0);
  });

  test('can skip past the header and nav with the keyboard', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('turns staff mode on with ?staff=1 and keeps it', async ({ page }) => {
    await page.goto(`/programs/${seed.ozone.id}?staff=1`);
    await expect(page.locator('app-layout-control')).toHaveCount(1);
    await page.goto(`/programs/${seed.ozone.id}`);
    await expect(page.locator('app-layout-control')).toHaveCount(1);
    await page.goto(`/programs/${seed.ozone.id}?staff=0`);
    await expect(page.locator('app-layout-control')).toHaveCount(0);
  });
});
