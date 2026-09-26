import { expect, Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}
  async open() { await this.page.goto('/account/login', { waitUntil: 'domcontentloaded' }); }
  async login(email: string, password: string) {
    await this.page.getByLabel(/email address/i).fill(email);
    await this.page.getByLabel(/^password$/i).fill(password);
    await this.page.locator('form[action*="/account/login"] input[type="submit"], form[action*="/account/login"] button[type="submit"]').first().click();
  }
  async expectError() {
    await expect(this.page.getByText(/incorrect|invalid|error/i).first()).toBeVisible();
  }
}
