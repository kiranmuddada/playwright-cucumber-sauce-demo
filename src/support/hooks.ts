import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  After,
  AfterStep,
  Before,
  Status,
  setDefaultTimeout,
} from "@cucumber/cucumber";
import { chromium, firefox, webkit } from "@playwright/test";
import { runQafixOnTrace, saveQafixOutput } from "./qafix";
import { NAVIGATION_ATTEMPTS } from "./navigation";
import { CustomWorld, type FailedStep } from "./world";

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
/** Suite runs only save traces; heal them afterwards with `npm run heal`. */
const inlineQafix = process.env.QAFIX_INLINE === "1";

Before(async function (this: CustomWorld) {
  this.failedStep = undefined;
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

AfterStep(async function (this: CustomWorld, { pickle, pickleStep, gherkinDocument, result }) {
  if (result.status !== Status.FAILED) return;
  const recorded = failedStepFromHook(pickle, pickleStep, gherkinDocument);
  if (recorded) this.failedStep = recorded;
});

After(
  { timeout: 600_000 },
  async function (this: CustomWorld, { gherkinDocument, pickle, result }) {
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
      writeIdentitySidecar(tracePath, gherkinDocument, pickle, this.failedStep);
      if (process.env.QAFIX_SKIP !== "1" && inlineQafix) {
        const diagnosis = runQafixOnTrace(tracePath);
        if (diagnosis.trim()) {
          saveQafixOutput(safeName, diagnosis);
          await this.attach(diagnosis, "text/plain");
        }
      }
    } else if (tracingEnabled) {
      await this.context.tracing.stop();
    }
    await this.context.close();
    await this.browser?.close();
  },
);

/**
 * Cucumber identity cannot be recovered from a Playwright library trace, so
 * qafix reads `{ feature, line, scenario }` from a sidecar next to the zip.
 */
function writeIdentitySidecar(
  tracePath: string,
  gherkinDocument: {
    feature?: {
      children: readonly {
        scenario?: { id: string; location: { line: number } };
      }[];
    };
  },
  pickle: { astNodeIds: readonly string[]; name: string; uri: string },
  failedStep: FailedStep | undefined,
): void {
  const astNodeId = pickle.astNodeIds[0] ?? pickle.astNodeIds.at(-1);
  const scenario = gherkinDocument.feature?.children
    .map((child) => child.scenario)
    .find((candidate) => candidate?.id === astNodeId);
  if (!scenario) return;
  writeFileSync(
    `${tracePath}.qafix.json`,
    `${JSON.stringify(
      {
        feature: path.relative(process.cwd(), path.resolve(pickle.uri)),
        line: scenario.location.line,
        scenario: pickle.name,
        ...(failedStep === undefined ? {} : { step: failedStep }),
      },
      null,
      2,
    )}\n`,
  );
}

function timeoutFromEnv(name: string, fallback: number): number {
  const configured = Number(process.env[name] ?? fallback);
  return Number.isFinite(configured) && configured > 0 ? configured : fallback;
}

type GherkinStepLike = {
  id: string;
  keyword: string;
  location: { line: number };
};

/**
 * Maps the failed pickle step back to its Gherkin keyword and feature line.
 * Returns undefined when the document has no matching step.
 */
function failedStepFromHook(
  pickle: { steps: readonly { id: string }[] },
  pickleStep: { id: string; astNodeIds: readonly string[]; text: string },
  gherkinDocument: {
    feature?: {
      children: readonly {
        background?: { steps: readonly GherkinStepLike[] };
        scenario?: { steps: readonly GherkinStepLike[] };
        rule?: {
          children: readonly {
            background?: { steps: readonly GherkinStepLike[] };
            scenario?: { steps: readonly GherkinStepLike[] };
          }[];
        };
      }[];
    };
  },
): FailedStep | undefined {
  const index = pickle.steps.findIndex((step) => step.id === pickleStep.id);
  if (index < 0) return undefined;
  const astNodeId = pickleStep.astNodeIds[0];
  const gherkinStep = gherkinSteps(gherkinDocument).find(
    (step) => step.id === astNodeId,
  );
  if (!gherkinStep || gherkinStep.location.line < 1) return undefined;
  return {
    index,
    keyword: gherkinStep.keyword.trim(),
    text: pickleStep.text,
    line: gherkinStep.location.line,
  };
}

function gherkinSteps(gherkinDocument: {
  feature?: {
    children: readonly {
      background?: { steps: readonly GherkinStepLike[] };
      scenario?: { steps: readonly GherkinStepLike[] };
      rule?: {
        children: readonly {
          background?: { steps: readonly GherkinStepLike[] };
          scenario?: { steps: readonly GherkinStepLike[] };
        }[];
      };
    }[];
  };
}): GherkinStepLike[] {
  const children = gherkinDocument.feature?.children ?? [];
  const steps: GherkinStepLike[] = [];
  for (const child of children) {
    if (child.background) steps.push(...child.background.steps);
    if (child.scenario) steps.push(...child.scenario.steps);
    for (const ruleChild of child.rule?.children ?? []) {
      if (ruleChild.background) steps.push(...ruleChild.background.steps);
      if (ruleChild.scenario) steps.push(...ruleChild.scenario.steps);
    }
  }
  return steps;
}
