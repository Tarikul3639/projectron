import { BadRequestException, Injectable } from '@nestjs/common';
import type { Dialog, Request } from 'playwright';
import { BrowserSessionService } from './browser-session.service.js';
import { assertSafeBrowserUrl } from '../utils/browser.utils.js';

// Handles page navigation, DOM inspection, interaction, and browser diagnostics.
/** Provides the browser page functionality for this module. */
@Injectable()
export class BrowserPageService {
  private readonly requests = new Map<
    string,
    Array<{
      url: string;
      method: string;
      resourceType: string;
      failure?: string;
    }>
  >();
  private readonly dialogs = new Map<string, Dialog>();
  private readonly securedPages = new Set<string>();
  private readonly consoleEntries = new Map<
    string,
    Array<{ type: string; text: string; timestamp: number }>
  >();
  private readonly pageErrors = new Map<
    string,
    Array<{ message: string; stack?: string }>
  >();
  /** Creates the service and initializes its dependencies. */
  constructor(private readonly sessions: BrowserSessionService) {}

  /** Checks initial and redirected requests before allowing the browser to reach a host. */
  async navigate(input: {
    url: string;
    pageId?: string;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    timeoutMs?: number;
  }) {
    await assertSafeBrowserUrl(input.url);
    const record = this.sessions.getPage(input.pageId);
    this.attachDiagnostics(record.id);
    if (!this.securedPages.has(record.id)) {
      await record.page.route('**/*', async (route) => {
        try {
          await assertSafeBrowserUrl(route.request().url());
          await route.continue();
        } catch {
          await route.abort('blockedbyclient');
        }
      });
      this.securedPages.add(record.id);
    }
    const response = await record.page.goto(input.url, {
      waitUntil: input.waitUntil ?? 'domcontentloaded',
      timeout: input.timeoutMs ?? 30000,
    });
    return {
      pageId: record.id,
      url: record.page.url(),
      title: await record.page.title(),
      status: response?.status() ?? null,
    };
  }

  /** Returns title, URL, description metadata, and document readiness. */
  async info(pageId?: string) {
    return this.sessions.getPage(pageId).page.evaluate(() => ({
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      description:
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute('content') ?? null,
      language: document.documentElement.lang,
      viewport: { width: innerWidth, height: innerHeight },
    }));
  }

  /** Extracts bounded visible text from the current page or a selected element. */
  async text(input: {
    pageId?: string;
    selector?: string;
    maxCharacters?: number;
  }) {
    const page = this.sessions.getPage(input.pageId).page;
    const value = input.selector
      ? await page.locator(input.selector).innerText({ timeout: 10000 })
      : await page.locator('body').innerText({ timeout: 10000 });
    return value.slice(0, input.maxCharacters ?? 20000);
  }

  /** Returns a bounded HTML fragment for structural inspection. */
  async html(input: { pageId?: string; selector?: string }) {
    return (
      await this.sessions
        .getPage(input.pageId)
        .page.locator(input.selector ?? 'html')
        .evaluate((element) => element.outerHTML)
    ).slice(0, 100000);
  }

  /** Returns a compact semantic DOM outline for AI inspection. */
  async dom(pageId?: string) {
    return this.sessions
      .getPage(pageId)
      .page.locator('body')
      .evaluate((body) =>
        [
          ...body.querySelectorAll(
            'h1,h2,h3,button,a,input,textarea,select,[role="button"],[aria-label]',
          ),
        ]
          .slice(0, 500)
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            text: (element.textContent ?? '').trim().slice(0, 300),
            role: element.getAttribute('role'),
            label: element.getAttribute('aria-label'),
            id: element.id || null,
            name: element.getAttribute('name'),
            href:
              element instanceof HTMLAnchorElement ? element.href : undefined,
            type: element.getAttribute('type'),
          })),
      );
  }

  /** Lists links with visible text and absolute destinations. */
  async links(input: { pageId?: string; limit?: number }) {
    return this.sessions
      .getPage(input.pageId)
      .page.locator('a[href]')
      .evaluateAll(
        (nodes, limit) =>
          nodes.slice(0, limit).map((node) => ({
            text: (node.textContent ?? '').trim().slice(0, 500),
            href: (node as HTMLAnchorElement).href,
            target: node.getAttribute('target'),
          })),
        input.limit ?? 100,
      );
  }

  /** Waits for a selector to reach the requested state. */
  async waitFor(input: {
    pageId?: string;
    selector: string;
    state?: 'attached' | 'detached' | 'visible' | 'hidden';
    timeoutMs?: number;
  }) {
    await this.sessions
      .getPage(input.pageId)
      .page.locator(input.selector)
      .waitFor({
        state: input.state ?? 'visible',
        timeout: input.timeoutMs ?? 30000,
      });
    return { selector: input.selector, state: input.state ?? 'visible' };
  }

  /** Waits for the current page to match a URL glob or regular expression string. */
  async waitForUrl(input: {
    pageId?: string;
    url: string;
    timeoutMs?: number;
  }) {
    await this.sessions
      .getPage(input.pageId)
      .page.waitForURL(input.url, { timeout: input.timeoutMs ?? 30000 });
    return { url: this.sessions.getPage(input.pageId).page.url() };
  }

  /** Performs locator-based interaction without arbitrary script execution. */
  async interact(input: {
    pageId?: string;
    selector: string;
    action:
      | 'click'
      | 'dblclick'
      | 'hover'
      | 'fill'
      | 'check'
      | 'uncheck'
      | 'focus'
      | 'select';
    value?: string;
    values?: string[];
  }) {
    const locator = this.sessions
      .getPage(input.pageId)
      .page.locator(input.selector);
    switch (input.action) {
      case 'click':
        await locator.click();
        break;
      case 'dblclick':
        await locator.dblclick();
        break;
      case 'hover':
        await locator.hover();
        break;
      case 'fill':
        await locator.fill(input.value ?? '');
        break;
      case 'check':
        await locator.check();
        break;
      case 'uncheck':
        await locator.uncheck();
        break;
      case 'focus':
        await locator.focus();
        break;
      case 'select':
        await locator.selectOption(input.values ?? []);
        break;
    }
    return { action: input.action, selector: input.selector, completed: true };
  }

  /** Sends a keyboard key to a selected element or the active page. */
  async press(input: { pageId?: string; selector?: string; key: string }) {
    const page = this.sessions.getPage(input.pageId).page;
    if (input.selector) await page.locator(input.selector).press(input.key);
    else await page.keyboard.press(input.key);
    return { key: input.key, completed: true };
  }

  /** Scrolls the page by bounded pixel offsets. */
  async scroll(input: { pageId?: string; deltaX?: number; deltaY?: number }) {
    const page = this.sessions.getPage(input.pageId).page;
    await page.mouse.wheel(input.deltaX ?? 0, input.deltaY ?? 600);
    return { scrolled: true, url: page.url() };
  }

  /** Returns an accessibility-oriented outline of semantic page elements. */
  async accessibility(pageId?: string) {
    return this.sessions
      .getPage(pageId)
      .page.locator('body')
      .evaluate((body) =>
        [
          ...body.querySelectorAll(
            'main,nav,header,footer,button,a,input,textarea,select,[role]',
          ),
        ]
          .slice(0, 300)
          .map((node) => ({
            role: node.getAttribute('role') ?? node.tagName.toLowerCase(),
            name:
              node.getAttribute('aria-label') ??
              (node.textContent ?? '').trim().slice(0, 200),
            disabled: (node as HTMLButtonElement).disabled ?? false,
          })),
      );
  }

  /** Attaches bounded network and dialog event collection to a tab. */
  attachDiagnostics(pageId?: string) {
    const record = this.sessions.getPage(pageId);
    if (this.requests.has(record.id))
      return { attached: true, pageId: record.id };
    const entries: Array<{
      url: string;
      method: string;
      resourceType: string;
      failure?: string;
    }> = [];
    this.requests.set(record.id, entries);
    record.page.on('request', (request: Request) => {
      entries.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
      });
      if (entries.length > 1000) entries.shift();
    });
    record.page.on('requestfailed', (request) => {
      entries.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        failure: request.failure()?.errorText,
      });
    });
    const consoleRows: Array<{
      type: string;
      text: string;
      timestamp: number;
    }> = [];
    const errors: Array<{ message: string; stack?: string }> = [];
    this.consoleEntries.set(record.id, consoleRows);
    this.pageErrors.set(record.id, errors);
    record.page.on('console', (message) => {
      consoleRows.push({
        type: message.type(),
        text: message.text().slice(0, 4000),
        timestamp: Date.now(),
      });
      if (consoleRows.length > 500) consoleRows.shift();
    });
    record.page.on('pageerror', (error) => {
      errors.push({
        message: error.message,
        stack: error.stack?.slice(0, 8000),
      });
      if (errors.length > 200) errors.shift();
    });
    record.page.on('dialog', (dialog) => {
      this.dialogs.set(record.id, dialog);
    });
    return { attached: true, pageId: record.id };
  }

  /** Returns captured network request metadata for a tab. */
  network(pageId?: string) {
    return this.requests.get(this.sessions.getPage(pageId).id) ?? [];
  }

  /** Returns captured browser console messages for a tab. */
  consoleLogs(pageId?: string) {
    return this.consoleEntries.get(this.sessions.getPage(pageId).id) ?? [];
  }

  /** Returns uncaught JavaScript errors emitted by the page. */
  errors(pageId?: string) {
    return this.pageErrors.get(this.sessions.getPage(pageId).id) ?? [];
  }

  /** Returns image URLs, alt text, natural dimensions, and loading state. */
  async images(pageId?: string) {
    return this.sessions
      .getPage(pageId)
      .page.locator('img')
      .evaluateAll((nodes) =>
        nodes.slice(0, 500).map((node) => {
          const image = node as HTMLImageElement;
          return {
            src: image.currentSrc || image.src,
            alt: image.alt,
            width: image.naturalWidth,
            height: image.naturalHeight,
            loading: image.loading,
            complete: image.complete,
          };
        }),
      );
  }

  /** Returns browser timing and resource performance entries for page diagnostics. */
  async performance(pageId?: string) {
    return this.sessions.getPage(pageId).page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as
        PerformanceNavigationTiming | undefined;
      return {
        url: location.href,
        loadMs: navigation?.loadEventEnd ?? null,
        domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
        responseMs: navigation?.responseEnd ?? null,
        resourceCount: performance.getEntriesByType('resource').length,
        transferSize: performance
          .getEntriesByType('resource')
          .reduce(
            (total, item) =>
              total + ((item as PerformanceResourceTiming).transferSize || 0),
            0,
          ),
      };
    });
  }

  /** Drags one element onto another using Playwright locator actions. */
  async dragAndDrop(input: {
    pageId?: string;
    source: string;
    target: string;
  }) {
    await this.sessions
      .getPage(input.pageId)
      .page.locator(input.source)
      .dragTo(this.sessions.getPage(input.pageId).page.locator(input.target));
    return { source: input.source, target: input.target, completed: true };
  }

  /** Handles the latest JavaScript dialog after diagnostics have been attached. */
  async handleDialog(input: {
    pageId?: string;
    action: 'accept' | 'dismiss';
    promptText?: string;
  }) {
    const id = this.sessions.getPage(input.pageId).id;
    const dialog = this.dialogs.get(id);
    if (!dialog)
      throw new BadRequestException(
        'No pending browser dialog exists for this page',
      );
    if (input.action === 'accept') await dialog.accept(input.promptText);
    else await dialog.dismiss();
    this.dialogs.delete(id);
    return { action: input.action, handled: true };
  }

  /** Navigates back or forward in the current page history. */
  async history(pageId: string | undefined, direction: 'back' | 'forward') {
    const page = this.sessions.getPage(pageId).page;
    const response =
      direction === 'back' ? await page.goBack() : await page.goForward();
    return { url: page.url(), status: response?.status() ?? null };
  }

  /** Reloads the current page and reports its final URL. */
  async reload(pageId?: string) {
    const page = this.sessions.getPage(pageId).page;
    await page.reload();
    return { url: page.url(), title: await page.title() };
  }
}
