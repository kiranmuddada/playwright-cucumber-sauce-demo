@catalog
Feature: Browse the product catalog
  As a shopper
  I want to browse products
  So that I can choose an item

  @smoke
  Scenario: Open the catalog and view a product
    Given I open the Sauce Demo home page
    When I open the product catalog
    Then I should see the product "Grey jacket"
    When I open the product "Grey jacket"
    Then the product title should be "Grey jacket"
    And the product price should be "£55.00"
