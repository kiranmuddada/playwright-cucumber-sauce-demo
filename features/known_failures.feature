@known_failure
Feature: Deliberately failing examples for failure-analysis training
  These scenarios are excluded from the default test command.
  Run them with: npm run test:known-failures

  @broken_locator
  Scenario: Demonstrate an incorrect locator
    Given I open the Sauce Demo home page
    When I use the intentionally incorrect catalog locator
    Then I should see the product "Brown Shades"

  @broken_locator
  Scenario: Open a product from the catalog
    Given I open the Sauce Demo home page
    When I open the product catalog
    And I open "Brown Shades" using the product card locator
    Then the product title should be "Grey jacket"

  @application_failure
  Scenario: Demonstrate a missing application item
    Given I open the product catalog directly
    Then the application should contain product "Sauce Labs Backpack"

  @application_failure
  Scenario: Demonstrate an incorrect business expectation
    Given I open the cart
    Then the application should show a populated cart
