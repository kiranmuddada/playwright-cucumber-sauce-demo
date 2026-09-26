import { expect, Page } from "@playwright/test";

export class CartPage {
  constructor(private readonly page: Page) {}
  async open() {
    await this.page.goto("/cart");
  }
  async expectEmpty() {
    await expect(this.page.getByText(/cart is currently empty/i)).toBeVisible();
  }
  async expectContinueShopping() {
    await expect(
      this.page.getByRole("link", { name: /continue shopping/i }),
    ).toBeVisible();
  }
  async clickContinueShoppingUsingBrokenCssLocator() {
    await this.page
      .locator("#missing-continue-shopping")
      .click({ timeout: 5_000 });
  }
  async clickContinueShoppingUsingBrokenXPathLocator() {
    await this.page
      .locator('xpath=//a[@data-testid="missing-continue-shopping"]')
      .click({ timeout: 5_000 });
  }
  async openProductUsingBrokenXPathLocator() {
    await this.page
      .locator('xpath=//a[@id="missing-grey-jacket"]')
      .click({ timeout: 5_000 });
  }
  async expectPopulated() {
    await expect(
      this.page.getByRole("button", { name: /checkout/i }),
    ).toBeVisible();
  }
}
