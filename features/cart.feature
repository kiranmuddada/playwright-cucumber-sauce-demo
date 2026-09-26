@cart
Feature: Shopping cart

  @smoke
  Scenario: Empty cart displays a helpful message
    Given I open the cart
    Then the cart should be empty
    And I should see a continue shopping link

  @known_failure @qafix_validation @qafix_css
  Scenario: Heal a stale CSS locator and reach the catalog
    Given I open the cart
    When I click continue shopping using a broken CSS locator
    Then I should see the product "Black heels"

  @known_failure @qafix_validation @qafix_xpath
  Scenario: Heal a stale XPath locator on continue shopping
    Given I open the cart
    When I click continue shopping using a broken XPath locator
    Then I should see the product "Black heels"

  @known_failure @qafix_validation @qafix_multi_locator
  Scenario: Heal multiple CSS and XPath locators and reach the catalog
    Given I open the cart
    When I click the cart link using a broken CSS locator
    And I click continue shopping using a broken XPath locator
    Then I should see the product "Grey jacket"
