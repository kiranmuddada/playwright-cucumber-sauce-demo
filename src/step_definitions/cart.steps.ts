import { Given, Then, When } from "@cucumber/cucumber";
import { CustomWorld } from "../support/world";
import { CartPage } from "../pages/CartPage";

const cart = (world: CustomWorld) => {
  if (!world.page) throw new Error("Page was not initialized");
  return new CartPage(world.page);
};
Given("I open the cart", async function (this: CustomWorld) {
  await cart(this).open();
});
Then("the cart should be empty", async function (this: CustomWorld) {
  await cart(this).expectEmpty();
});
Then(
  "I should see a continue shopping link",
  async function (this: CustomWorld) {
    await cart(this).expectContinueShopping();
  },
);
When(
  "I click continue shopping using a broken CSS locator",
  async function (this: CustomWorld) {
    await cart(this).clickContinueShoppingUsingBrokenCssLocator();
  },
);
When(
  "I click the cart link using a broken CSS locator",
  async function (this: CustomWorld) {
    await cart(this).clickCartLinkUsingBrokenCssLocator();
  },
);
When(
  "I click continue shopping using a broken XPath locator",
  async function (this: CustomWorld) {
    await cart(this).clickContinueShoppingUsingBrokenXPathLocator();
  },
);
When(
  "I open the product using a broken XPath locator",
  async function (this: CustomWorld) {
    await cart(this).openProductUsingBrokenXPathLocator();
  },
);
Then(
  "the application should show a populated cart",
  async function (this: CustomWorld) {
    await cart(this).expectPopulated();
  },
);
