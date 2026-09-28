import { mkdirSync } from "node:fs";
import path from "node:path";
import { After, Before, Status, setDefaultTimeout } from "@cucumber/cucumber";
import { chromium, firefox, webkit } from "@playwright/test";
import { NAVIGATION_ATTEMPTS } from "./navigation";
import { CustomWorld } from "./world";

const actionTimeout = timeoutFromEnv("QAFIX_ACTION_TIMEOUT_MS", 10_000);
const navigationTimeout = timeoutFromEnv("QAFIX_NAVIGATION_TIMEOUT_MS", 25_000);
// Every navigation attempt must finish inside the step timeout, so Playwright
// reports a TimeoutError with a trace instead of Cucumber killing the step.
setDefaultTimeout(
  Math.max(30_000, navigationTimeout * NAVIGATION_ATTEMPTS + 10_000),
);

const verificationTracePath = process.env.QAFIX_CAPTURE_TRACE_PATH;
const tracingEnabled =
  process.env.QAFIX_SKIP !== "1" || verificationTracePath !== undefined;

Before(async function (this: CustomWorld) {
  const name = (process.env.BROWSER || "chromium").toLowerCase();
  const browserType =
    name === "firefox" ? firefox : name === "webkit" ? webkit : chromium;
  this.browser = await browserType.launch({
    headless: process.env.HEADLESS !== "false",
  });
  this.context = await this.browser.newContext({
    baseURL: process.env.BASE_URL || "https://sauce-demo.myshopify.com",
    viewport: { width: 1440, height: 900 },
  });
  if (tracingEnabled) {
    await this.context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
  }
  this.context.setDefaultTimeout(actionTimeout);
  this.context.setDefaultNavigationTimeout(navigationTimeout);
  this.page = await this.context.newPage();
});

/**
 * Failed scenarios save `test-results/<scenario-slug>-trace.zip`. qafix
 * matches that name to `reports/cucumber-report.json` to find the scenario
 * and failed step, so keep the name and the json formatter in step.
 */
After(async function (this: CustomWorld, { pickle, result }) {
  if (!this.context || !this.page) return;
  const failed = result?.status === Status.FAILED;
  const safeName = pickle.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  if (failed && tracingEnabled) {
    const tracePath =
      verificationTracePath ?? `test-results/${safeName}-trace.zip`;
    if (process.env.QAFIX_SKIP !== "1") {
      const screenshot = await this.page.screenshot({ fullPage: true });
      await this.attach(screenshot, "image/png");
    }
    mkdirSync(path.dirname(tracePath), { recursive: true });
    await this.context.tracing.stop({ path: tracePath });
  } else if (tracingEnabled) {
    await this.context.tracing.stop();
  }
  await this.context.close();
  await this.browser?.close();
});

function timeoutFromEnv(name: string, fallback: number): number {
  const configured = Number(process.env[name] ?? fallback);
  return Number.isFinite(configured) && configured > 0 ? configured : fallback;
}
