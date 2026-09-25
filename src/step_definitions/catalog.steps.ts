import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { HomePage } from '../pages/HomePage';
import { ProductPage } from '../pages/ProductPage';

const pageOf = (world: CustomWorld) => {
  if (!world.page) {
    throw new Error('Page was not initialized by the Before hook');
  }
  return world.page;
};

Given('I open the Sauce Demo home page', async function (this: CustomWorld) {
  await new HomePage(pageOf(this)).open();
});

When('I open the product catalog', async function (this: CustomWorld) {
  await new HomePage(pageOf(this)).openCatalog();
});

When('I click on checkout', async function (this: CustomWorld) {
  await new HomePage(pageOf(this)).clickCheckout();
});

Given('I open the product catalog directly', async function (this: CustomWorld) {
  await pageOf(this).goto('/collections/all');
});

Then('I should see the product {string}', async function (
  this: CustomWorld,
  name: string
) {
  await new HomePage(pageOf(this)).expectProduct(name);
});

When('I open the product {string}', async function (
  this: CustomWorld,
  name: string
) {
  await new HomePage(pageOf(this)).openProduct(name);
});

When('I open {string} using the product card locator', async function (
  this: CustomWorld,
  name: string
) {
  await new HomePage(pageOf(this)).openProductUsingBadLocator(name);
});

Then('the product title should be {string}', async function (
  this: CustomWorld,
  title: string
) {
  await new ProductPage(pageOf(this)).expectTitle(title);
});

Then('the product price should be {string}', async function (
  this: CustomWorld,
  price: string
) {
  await new ProductPage(pageOf(this)).expectPrice(price);
});

When(
  'I use the intentionally incorrect catalog locator',
  async function (this: CustomWorld) {
    await new HomePage(pageOf(this)).clickCatalogUsingBadLocator();
  }
);

Then(
  'the intentionally incorrect product heading should be visible',
  async function (this: CustomWorld) {
    await new ProductPage(pageOf(this)).expectHeadingUsingBadLocator();
  }
);

Then('the application should contain product {string}', async function (
  this: CustomWorld,
  name: string
) {
  await expect(
    pageOf(this).getByRole('link', { name, exact: true })
  ).toBeVisible({ timeout: 5_000 });
});
