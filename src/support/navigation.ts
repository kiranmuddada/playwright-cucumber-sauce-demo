import type { Page } from "@playwright/test";

export const NAVIGATION_ATTEMPTS = 2;

/**
 * Opens `url` once the DOM is ready, without waiting for third-party scripts,
 * and retries a navigation timeout. The Cucumber step timeout in hooks.ts must
 * cover every attempt.
 */
export async function gotoPage(page: Page, url: string): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      if (attempt >= NAVIGATION_ATTEMPTS || !isTimeout(error)) throw error;
      console.warn(
        `Navigation to ${url} timed out; retrying (attempt ${attempt + 1} of ${NAVIGATION_ATTEMPTS}).`,
      );
    }
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}
