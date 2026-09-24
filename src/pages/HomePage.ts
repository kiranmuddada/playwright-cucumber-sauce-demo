import { expect, Locator, Page } from '@playwright/test';

export class HomePage {
  readonly catalogLink: Locator;

  constructor(private readonly page: Page) {
    this.catalogLink = page.getByRole('link', { name: 'Catalog', exact: true });
  }

  async open() {
    await this.page.goto('/');
  }

  async openCatalog() {
    await this.catalogLink.click();
  }

  productLink(name: string) {
    return this.page.getByRole('link', { name: new RegExp(name, 'i') }).first();
  }

  async expectProduct(name: string) {
    await expect(this.productLink(name)).toBeVisible();
  }

  async openProduct(name: string) {
    await this.productLink(name).click();
  }

  /**
   * Intentionally incorrect locator used only by @broken_locator scenarios.
   * The ID does not exist in the application and must not be used in normal tests.
   */
  async clickCatalogUsingBadLocator() {
    await this.page
      .locator('#catalog-menu-that-does-not-exist')
      .click({ timeout: 5_000 });
  }
}
