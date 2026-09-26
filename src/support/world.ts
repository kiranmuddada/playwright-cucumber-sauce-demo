import { IWorldOptions, World, setWorldConstructor } from '@cucumber/cucumber';
import { Browser, BrowserContext, Page } from '@playwright/test';

/** The Gherkin step that failed, recorded so qafix can map it to a page-object method. */
export interface FailedStep {
  /** Zero-based index in the pickle's steps. */
  index: number;
  keyword: string;
  text: string;
  /** Line in the feature file. */
  line: number;
}

export class CustomWorld extends World {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  failedStep?: FailedStep;
  constructor(options: IWorldOptions) { super(options); }
}
setWorldConstructor(CustomWorld);
