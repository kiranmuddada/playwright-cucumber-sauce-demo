# Proposed Architecture

<img width="487" height="687" alt="Screenshot 2026-09-21 at 5 32 06 PM" src="https://github.com/user-attachments/assets/14b772e2-35f8-4d27-b8ae-3b86de975f2f" />

# Playwright + Cucumber BDD: Sauce Demo

A public-repository-ready TypeScript framework for testing [Sauce Demo](https://sauce-demo.myshopify.com/) with Playwright browser automation and Cucumber BDD.

## Included

- Gherkin feature files
- Cucumber step definitions
- Page Object Model classes
- Chromium, Firefox, or WebKit selection through an environment variable
- Cucumber HTML and JSON reports
- Screenshots and Playwright traces on failure
- GitHub Actions CI
- Passing smoke scenarios
- Deliberately broken-locator and application-failure scenarios, isolated with `@known_failure`

## Project structure

```text
features/                  Business-readable Gherkin scenarios
src/pages/                 Page Object Model classes
src/step_definitions/      Step implementation
src/support/               Custom World and lifecycle hooks
scripts/                   Report generator
.github/workflows/         CI pipeline
reports/                   Generated reports, ignored by Git
```

## Setup

Link the local [`qa-fix`](../../qaFixAIAgent/qa-fix) CLI first (from that repo):

```bash
npm ci
npm run build
npm link
```

Then in this Playwright repo:

```bash
npm ci
npm link qafix
npx playwright install --with-deps chromium
cp .env.example .env
```

Environment variables are optional. The framework defaults to the public Sauce Demo URL, Chromium, and headless execution.

## Run

```bash
npm test                    # normal tests, excludes known failures
npm run test:smoke          # smoke suite
npm run test:known-failures # deliberately failing examples
npm run test:suite          # every feature, including known failures
npm run typecheck
```

Every run saves a trace for each failed scenario. To heal them, see [QA-Fix connection](#qa-fix-connection).

Open `reports/cucumber-report.html` for Cucumber's built-in report. The post-test script also creates the richer report under `reports/html/` when the standard `npm test` command reaches `posttest`.

## QA-Fix connection

This repo depends on the local [`qa-fix`](../../qaFixAIAgent/qa-fix) CLI (`npm ci`, `npm run build`, `npm link` there, then `npm link qafix` here). Running the suite and healing are separate steps. A suite run only saves `test-results/<scenario>-trace.zip` and its `.qafix.json` sidecar for each failed scenario. Healing reads those traces afterwards. `qafix` reads Playwright traces only; Cucumber JSON/HTML reports stay with this project.

Run from this repo's root. No environment variables are needed.

**Run the suite only (no healing)**

```bash
npm run test:suite                                    # every feature
npm run test:suite -- features/cart.feature           # one feature
npm run test:suite -- --tags '@known_failure'         # by tag

npx qafix test                                        # every feature
npx qafix test features/cart.feature --name "Heal a stale XPath locator on continue shopping"
```

**Heal the failures from the saved traces**

```bash
npm run heal                                          # heal test-results, write reports/qafix/heal-map.md
npm run heal:dry-run                                  # heal map and prompts only, no edits
npm run heal -- test-results/<scenario>-trace.zip     # one trace

npx qafix heal test-results --report reports/qafix
npx qafix heal test-results --dry-run
npx qafix heal test-results/<scenario>-trace.zip
```

**Both in one command:** `npm run test:qafix` runs every feature, then heals. `npm run test:qafix-batch` tests the heal wrapper script; it does not heal.

Every `npm test` / `npm run test*` script cleans `test-results/` first, so heal before starting another suite run. Set `QAFIX_INLINE=1` to run qafix on each failing scenario during the suite run instead (the old per-scenario diagnosis, written to `reports/qafix/<scenario>.txt`).

`npm run heal` runs `qafix heal` on every saved `trace.zip`. Each failed scenario's sidecar includes the failing step. qafix maps that step to the page-object method on the stack and writes `reports/qafix/heal-map.md` plus `heal-map.json`. Locators in the same page object are healed together, one agent edit per file, then each affected scenario is re-run.

- A locator failure is healed.
- An assertion or unknown failure is not edited. It is listed under **Bugs** in the heal map with the failing step and error.
- When a scenario has both, the broken locators before the failing assertion are healed. The locator edit is kept once the re-run gets past the healed step, and the later assertion or unknown failure is reported as a bug.
- If the re-run fails before reaching the healed step (for example, `Given I open the cart` times out), the locator edit cannot be verified. It is reverted, and that failure is reported as a bug.

The command exits nonzero while any bug is reported or any locator is unverified.

Timeouts: `QAFIX_ACTION_TIMEOUT_MS` (default 10000) caps clicks, fills, and other actions. `QAFIX_NAVIGATION_TIMEOUT_MS` (default 25000) caps `page.goto` and other navigations, and must stay below the 30-second Cucumber step timeout. Pages open with `waitUntil: 'domcontentloaded'`, so a slow third-party script cannot stall navigation. A navigation `TimeoutError` is reported as an unknown failure (`navigation-timeout`), not healed as a locator.

To repair a single trace with the older per-trace flow, from the **qa-fix** repo:

```bash
cd "/Users/c8v6gq/Library/CloudStorage/OneDrive-CIGNA/Desktop/Automation_Framewroks/qaFixAIAgent/qa-fix"
node dist/bin/qafix.js fix "/Users/c8v6gq/Library/CloudStorage/OneDrive-CIGNA/Desktop/Automation_Framewroks/Hackethon/playwright-cucumber-sauce-demo/test-results/<scenario>-trace.zip" --batch
```

`QAFIX_SKIP=1` turns off trace capture, so there is nothing to heal afterwards. Point at another CLI with `QAFIX_BIN=/path/to/qafix.js`.

## Why the failing tests are separated

`features/known_failures.feature` is intentionally red. It demonstrates:

1. **Broken locator:** `HomePage` and `ProductPage` contain clearly marked negative-test methods that use IDs or attributes that do not exist.
2. **Application/data failure:** the test expects a different demo product that is absent.
3. **Business expectation failure:** the test expects an empty cart to be populated.

These examples are useful for reporting, screenshots, traces, and debugging workshops. They are tagged `@known_failure` and excluded from default CI so failures are explicit rather than accidental.

## Create the public GitHub repository

```bash
git init
git add .
git commit -m "feat: add Playwright Cucumber BDD framework"
git branch -M main
gh repo create playwright-cucumber-sauce-demo --public --source=. --remote=origin --push
```

If GitHub CLI is unavailable, create an empty public repository in GitHub, then run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/playwright-cucumber-sauce-demo.git
git push -u origin main
```

## Locator guidance

Production POMs prefer Playwright's user-facing locators such as `getByRole`, `getByLabel`, and `getByText`. Intentionally brittle selectors are kept inside the relevant Page Objects and are clearly labeled as educational anti-patterns. `HomePage.ts` contains the incorrect catalog locator, while `ProductPage.ts` contains the incorrect product-heading locator.

## Responsible use

This framework targets a public demo shop. Keep traffic low, avoid load testing, and do not automate checkout/payment activity without site-owner permission.
