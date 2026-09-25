import { expect, Locator, Page } from '@playwright/test';

export class HomePage {
  readonly catalogLink: Locator;
  readonly checkoutLink: Locator;
  

  constructor(private readonly page: Page) {
    this.catalogLink = page.getByRole('link', { name: 'Catalog', exact: true });
    this.checkoutLink = page.locator('//*[@id="maxcart"]/a[3]');
  }

  async open() {
    await this.page.goto('/');
  }

  async openCatalog() {
    await this.catalogLink.click();
  }

  async clickCheckout() {
    await this.checkoutLink.click();
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

  async openProductUsingBadLocator(name: string) {
    await this.page
      .locator(`article[data-product-name="${name}"] a`)
      .click({ timeout: 5_000 });
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
