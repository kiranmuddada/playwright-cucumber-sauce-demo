@cart
Feature: Shopping cart

  @smoke
  Scenario: Empty cart displays a helpful message
    Given I open the cart
    Then the cart should be empty
    And I should see a continue shopping link

  @known_failure @qafix_validation @qafix_css
  Scenario: Heal a stale CSS locator on a cart link
    Given I open the cart
    When I click the cart link using a broken CSS locator
    Then I should see a continue shopping link

  @known_failure @qafix_validation @qafix_xpath
  Scenario: Heal a stale XPath locator on continue shopping
    Given I open the cart
    When I click continue shopping using a broken XPath locator
    Then I should see the product "Grey jacket"

  @known_failure @qafix_validation @qafix_multi_locator
  Scenario: Heal multiple stale locators in the cart flow
    Given I open the cart
    When I click the cart link using a broken CSS locator
    And I click continue shopping using a broken XPath locator
    Then I should see the product "Grey jacket"
