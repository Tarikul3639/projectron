import { Injectable } from '@nestjs/common';
import { CoordinationService } from '../../../core/coordination/services/coordination.service.js';
import { Tool } from '@nestjs/mcp';
import * as z from 'zod';
import { BrowserContextService } from '../services/browser-context.service.js';
import { BrowserInfoService } from '../services/browser-info.service.js';
import { BrowserSessionService } from '../services/browser-session.service.js';
import { BrowserPageService } from '../services/browser-page.service.js';
import { BrowserArtifactService } from '../services/browser-artifact.service.js';
import { BrowserDownloadService } from '../services/browser-download.service.js';

/** Publishes browser automation tools for isolated browser sessions. */
@Injectable()
export class BrowserTools {
  /** Injects the browser session, page, context, artifact, download, and capability services used by the MCP handlers. */
  constructor(
    private readonly contextData: BrowserContextService,
    private readonly browserInfo: BrowserInfoService,
    private readonly sessions: BrowserSessionService,
    private readonly pages: BrowserPageService,
    private readonly artifacts: BrowserArtifactService,
    private readonly downloads: BrowserDownloadService,
    private readonly coordination: CoordinationService,
  ) {}

  /** Serializes state-changing operations targeting the same browser tab or context. */
  private withPageLock<T>(
    pageId: string | undefined,
    operation: () => Promise<T>,
  ): Promise<T> {
    const page = this.sessions.getPage(pageId);
    return this.coordination.withExclusiveLock(
      'browser-page:' + page.id,
      operation,
      'browser-page-tool',
    );
  }

  private withSessionLock<T>(
    sessionId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.coordination.withExclusiveLock(
      'browser-session:' + sessionId,
      operation,
      'browser-session-tool',
    );
  }

  /** Returns the browser automation capabilities and safety restrictions. */
  @Tool({
    name: 'browser_capabilities',
    description: 'Describe supported browser features and safety restrictions.',
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  capabilities() {
    return this.browserInfo.capabilities();
  }

  /** Launches Chromium and creates an isolated browser session. */
  @Tool({
    name: 'browser_launch',
    description:
      'Launch headless Chromium and create an isolated browser context and first tab.',
    inputSchema: z
      .object({
        headless: z.boolean().optional(),
        slowMo: z.number().int().min(0).max(2000).optional(),
        timeoutMs: z.number().int().min(100).max(120000).optional(),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  launch(input: { headless?: boolean; slowMo?: number; timeoutMs?: number }) {
    return this.coordination.withExclusiveLock(
      'browser-engine',
      () => this.sessions.launch(input),
      'browser-engine',
    );
  }

  /** Closes browser sessions and releases their resources. */
  @Tool({
    name: 'browser_close',
    description: 'Close all browser sessions, tabs, and the Chromium process.',
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
  })
  close() {
    return this.coordination.withExclusiveLock(
      'browser-engine',
      () => this.sessions.close(),
      'browser-engine',
    );
  }

  /** Lists active browser sessions and their open pages. */
  @Tool({
    name: 'browser_list',
    description:
      'List browser sessions and open tabs with their URLs and titles.',
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  async list() {
    return {
      sessions: this.sessions.listSessions(),
      pages: await this.sessions.listPages(),
    };
  }

  /** Creates an isolated browser context. */
  @Tool({
    name: 'browser_new_context',
    description:
      'Create an isolated browser context with a separate cookie and storage jar.',
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  async newContext() {
    return this.coordination.withExclusiveLock(
      'browser-engine',
      async () => {
        const session = await this.sessions.createSession();
        return { sessionId: session.id, createdAt: session.createdAt };
      },
      'browser-context-create',
    );
  }

  /** Opens a new page in the selected browser context. */
  @Tool({
    name: 'browser_new_page',
    description: 'Open a new tab in the selected or current browser context.',
    inputSchema: z.object({ sessionId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  async newPage(input: { sessionId?: string }) {
    const sessionId = input.sessionId ?? this.sessions.getPage().sessionId;
    return this.withSessionLock(sessionId, async () => {
      const page = await this.sessions.createPage(sessionId);
      return { pageId: page.id, sessionId: page.sessionId };
    });
  }

  /** Closes page and releases its resources. */
  @Tool({
    name: 'browser_close_page',
    description: 'Close one browser tab.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
  })
  closePage(input: { pageId?: string }) {
    return this.withPageLock(input.pageId, () =>
      this.sessions.closePage(input.pageId),
    );
  }

  /** Closes session and releases its resources. */
  @Tool({
    name: 'browser_close_session',
    description: 'Close one isolated browser context and all of its tabs.',
    inputSchema: z.object({ sessionId: z.string().uuid() }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
  })
  closeSession(input: { sessionId: string }) {
    return this.withSessionLock(input.sessionId, () =>
      this.sessions.closeSession(input.sessionId),
    );
  }

  /** Navigates the selected tab after validating the destination and its redirects against browser network-safety rules. */
  @Tool({
    name: 'browser_navigate',
    description:
      'Navigate to an HTTP or HTTPS page. Local loopback servers are allowed for development; private LAN, link-local, and internal network destinations are blocked, including redirected requests.',
    inputSchema: z
      .object({
        url: z.string().url(),
        pageId: z.string().uuid().optional(),
        waitUntil: z
          .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
          .optional(),
        timeoutMs: z.number().int().min(100).max(120000).optional(),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  navigate(input: {
    url: string;
    pageId?: string;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    timeoutMs?: number;
  }) {
    return this.withPageLock(input.pageId, () => this.pages.navigate(input));
  }

  /** Moves the selected tab one entry backward in its navigation history. */
  @Tool({
    name: 'browser_go_back',
    description: 'Navigate to the previous page in the active tab history.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  back(input: { pageId?: string }) {
    return this.withPageLock(input.pageId, () =>
      this.pages.history(input.pageId, 'back'),
    );
  }

  /** Moves the selected tab one entry forward when a forward history entry exists. */
  @Tool({
    name: 'browser_go_forward',
    description: 'Navigate forward in the active tab history.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  forward(input: { pageId?: string }) {
    return this.withPageLock(input.pageId, () =>
      this.pages.history(input.pageId, 'forward'),
    );
  }

  /** Reloads the selected tab and waits for the page service's configured navigation lifecycle. */
  @Tool({
    name: 'browser_reload',
    description: 'Reload the active browser tab.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  reload(input: { pageId?: string }) {
    return this.withPageLock(input.pageId, () =>
      this.pages.reload(input.pageId),
    );
  }

  /** Retrieves the current page URL, title, metadata, viewport dimensions, and readiness state. */
  @Tool({
    name: 'browser_page_info',
    description:
      'Read page URL, title, metadata, viewport, and document readiness.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  pageInfo(input: { pageId?: string }) {
    return this.pages.info(input.pageId);
  }

  /** Extracts visible text from the page or a CSS-selected element, respecting the requested character bound. */
  @Tool({
    name: 'browser_get_text',
    description:
      'Extract visible page text or selected element text, with a character limit.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        selector: z.string().optional(),
        maxCharacters: z.number().int().min(1).max(100000).optional(),
      })
      .strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  getText(input: {
    pageId?: string;
    selector?: string;
    maxCharacters?: number;
  }) {
    return this.pages.text(input);
  }

  /** Retrieves a bounded HTML fragment from the page or selected element for structural inspection. */
  @Tool({
    name: 'browser_get_html',
    description: 'Read a bounded HTML fragment for page structure analysis.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        selector: z.string().optional(),
      })
      .strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  getHtml(input: { pageId?: string; selector?: string }) {
    return this.pages.html(input);
  }

  /** Builds a concise semantic outline of the active page's document structure and interactive elements. */
  @Tool({
    name: 'browser_get_dom',
    description:
      'Inspect a compact semantic DOM outline including headings, controls, labels, and links.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  getDom(input: { pageId?: string }) {
    return this.pages.dom(input.pageId);
  }

  /** Retrieves a bounded accessibility-oriented outline to help identify semantic controls and labels. */
  @Tool({
    name: 'browser_get_accessibility_tree',
    description:
      'Read a bounded accessibility-oriented outline of semantic page elements.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  accessibility(input: { pageId?: string }) {
    return this.pages.accessibility(input.pageId);
  }

  /** Lists visible links with their text and resolved destination URLs, subject to the requested result limit. */
  @Tool({
    name: 'browser_get_links',
    description:
      'List visible link text, target, and absolute URL from the current page.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  links(input: { pageId?: string; limit?: number }) {
    return this.pages.links(input);
  }

  /** Waits for a CSS selector to reach the requested attached, detached, visible, or hidden state. */
  @Tool({
    name: 'browser_wait_for_element',
    description:
      'Wait until a CSS selector becomes attached, detached, visible, or hidden.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        selector: z.string().min(1),
        state: z.enum(['attached', 'detached', 'visible', 'hidden']).optional(),
        timeoutMs: z.number().int().min(100).max(120000).optional(),
      })
      .strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  waitFor(input: {
    pageId?: string;
    selector: string;
    state?: 'attached' | 'detached' | 'visible' | 'hidden';
    timeoutMs?: number;
  }) {
    return this.pages.waitFor(input);
  }

  /** Waits until the active tab's URL matches the supplied pattern or expression, or the timeout expires. */
  @Tool({
    name: 'browser_wait_for_url',
    description:
      'Wait until the active page URL matches a glob or regular expression.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        url: z.string().min(1),
        timeoutMs: z.number().int().min(100).max(120000).optional(),
      })
      .strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  waitUrl(input: { pageId?: string; url: string; timeoutMs?: number }) {
    return this.pages.waitForUrl(input);
  }

  /** Performs the requested locator action, such as clicking, hovering, focusing, checking, or filling an element. */
  @Tool({
    name: 'browser_click',
    description:
      'Click, double-click, hover, focus, check, uncheck, or fill a page element.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        selector: z.string().min(1),
        action: z.enum([
          'click',
          'dblclick',
          'hover',
          'fill',
          'check',
          'uncheck',
          'focus',
        ]),
        value: z.string().optional(),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  interact(input: {
    pageId?: string;
    selector: string;
    action:
      'click' | 'dblclick' | 'hover' | 'fill' | 'check' | 'uncheck' | 'focus';
    value?: string;
  }) {
    return this.withPageLock(input.pageId, () => this.pages.interact(input));
  }

  /** Selects the supplied option values in the target select element and returns the selection result. */
  @Tool({
    name: 'browser_select_option',
    description: 'Select one or more options in a select element.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        selector: z.string().min(1),
        values: z.array(z.string()).min(1).max(100),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  select(input: { pageId?: string; selector: string; values: string[] }) {
    return this.withPageLock(input.pageId, () =>
      this.pages.interact({ ...input, action: 'select' }),
    );
  }

  /** Sends a keyboard key to the selected element, or to the active page when no selector is supplied. */
  @Tool({
    name: 'browser_press_key',
    description:
      'Press a keyboard key on a selected element or the active page.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        selector: z.string().optional(),
        key: z.string().min(1).max(100),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  press(input: { pageId?: string; selector?: string; key: string }) {
    return this.withPageLock(input.pageId, () => this.pages.press(input));
  }

  /** Scrolls the active page by the requested horizontal and vertical pixel offsets. */
  @Tool({
    name: 'browser_scroll',
    description: 'Scroll the current browser page by pixel offsets.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        deltaX: z.number().optional(),
        deltaY: z.number().optional(),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  scroll(input: { pageId?: string; deltaX?: number; deltaY?: number }) {
    return this.withPageLock(input.pageId, () => this.pages.scroll(input));
  }

  /** Captures a viewport, full-page, or element screenshot and optionally saves it within an allowed workspace root. */
  @Tool({
    name: 'browser_screenshot',
    description:
      'Capture the viewport, full page, or selected element as PNG/JPEG. A saved path must be inside an allowed workspace root.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        fullPage: z.boolean().optional(),
        selector: z.string().optional(),
        path: z.string().optional(),
        type: z.enum(['png', 'jpeg']).optional(),
        quality: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  screenshot(input: {
    pageId?: string;
    fullPage?: boolean;
    selector?: string;
    path?: string;
    type?: 'png' | 'jpeg';
    quality?: number;
  }) {
    return this.artifacts.screenshot(input);
  }

  /** Uploads the specified workspace files through a page file input after validating their allowed-root locations. */
  @Tool({
    name: 'browser_upload_file',
    description:
      'Upload local files to a webpage input; source files must be inside configured workspace roots.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        selector: z.string().min(1),
        filePaths: z.array(z.string().min(1)).min(1).max(20),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  upload(input: { pageId?: string; selector: string; filePaths: string[] }) {
    return this.withPageLock(input.pageId, () =>
      this.contextData.upload(input),
    );
  }

  /** Triggers a download by clicking the requested page element and returns its captured download identifier. */
  @Tool({
    name: 'browser_download',
    description:
      'Click a download link or button and capture its download record.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        selector: z.string().min(1),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  download(input: { pageId?: string; selector: string }) {
    return this.withPageLock(input.pageId, () => this.downloads.trigger(input));
  }

  /** Lists download records captured by the current Projectron server process without exposing temporary paths. */
  @Tool({
    name: 'browser_get_downloads',
    description:
      'List browser download records captured during this server process.',
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  getDownloads() {
    return this.downloads.list();
  }

  /** Waits for the identified download to finish and reports whether it completed or failed. */
  @Tool({
    name: 'browser_wait_for_download',
    description:
      'Wait for a captured browser download to finish and report its status.',
    inputSchema: z.object({ downloadId: z.string().uuid() }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  waitDownload(input: { downloadId: string }) {
    return this.downloads.wait(input.downloadId);
  }

  /** Saves a captured download to an absolute destination after enforcing workspace-root and symlink protections. */
  @Tool({
    name: 'browser_save_download',
    description:
      'Save a captured download to an absolute path inside an allowed workspace.',
    inputSchema: z
      .object({
        downloadId: z.string().uuid(),
        path: z.string().min(1),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  saveDownload(input: { downloadId: string; path: string }) {
    return this.downloads.save(input.downloadId, input.path);
  }

  /** Cancels an in-progress download using its captured download identifier. */
  @Tool({
    name: 'browser_cancel_download',
    description: 'Cancel a pending browser download.',
    inputSchema: z.object({ downloadId: z.string().uuid() }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  cancelDownload(input: { downloadId: string }) {
    return this.downloads.cancel(input.downloadId);
  }

  /** Prints the selected page to an A4 PDF at a destination inside a configured workspace root. */
  @Tool({
    name: 'browser_print_to_pdf',
    description: 'Print the current page to PDF inside an allowed workspace.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        path: z.string().min(1),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  pdf(input: { pageId?: string; path: string }) {
    return this.withPageLock(input.pageId, () =>
      this.artifacts.pdf(input.pageId, input.path),
    );
  }

  /** Starts Playwright tracing for the browser context that owns the selected page, including screenshots, snapshots, and sources. */
  @Tool({
    name: 'browser_trace_start',
    description: 'Start Playwright tracing for the selected browser context.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  traceStart(input: { pageId?: string }) {
    return this.withPageLock(input.pageId, () =>
      this.artifacts.traceStart(input.pageId),
    );
  }

  /** Stops the active context trace and writes its archive to a validated workspace destination. */
  @Tool({
    name: 'browser_trace_stop',
    description:
      'Stop browser tracing and save its archive inside an allowed workspace.',
    inputSchema: z
      .object({ pageId: z.string().uuid().optional(), path: z.string().min(1) })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  traceStop(input: { pageId?: string; path: string }) {
    return this.withPageLock(input.pageId, () =>
      this.artifacts.traceStop(input.pageId, input.path),
    );
  }

  /** Evaluates JavaScript in the selected page context. */
  @Tool({
    name: 'browser_evaluate',
    description:
      'Execute JavaScript in the selected page context; prefer a safe locator tool when it is sufficient.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        expression: z.string().min(1).max(20000),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  evaluate(input: { pageId?: string; expression: string }) {
    return this.withPageLock(input.pageId, () =>
      this.contextData.evaluate(input),
    );
  }

  /** Reads cookies from the selected isolated context and returns them with cookie values redacted. */
  @Tool({
    name: 'browser_get_cookies',
    description:
      'Read cookies from the selected isolated browser context; cookie values may contain secrets.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  cookies(input: { pageId?: string }) {
    return this.contextData.cookies(input.pageId);
  }

  /** Adds the supplied cookies to the selected isolated browser context. */
  @Tool({
    name: 'browser_set_cookies',
    description: 'Set cookies in the selected isolated browser context.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        cookies: z.array(z.record(z.string(), z.json())).min(1).max(100),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  setCookies(input: {
    pageId?: string;
    cookies: Array<Record<string, unknown>>;
  }) {
    return this.withPageLock(input.pageId, () =>
      this.contextData.setCookies(input),
    );
  }

  /** Reads localStorage or sessionStorage for the selected page origin, masking values under credential-like keys. */
  @Tool({
    name: 'browser_read_storage',
    description:
      'Read localStorage or sessionStorage for the current page origin.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        storage: z.enum(['local', 'session']),
      })
      .strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  readStorage(input: { pageId?: string; storage: 'local' | 'session' }) {
    return this.contextData.readStorage(input);
  }

  /** Writes one key/value pair to localStorage or sessionStorage in the selected page origin. */
  @Tool({
    name: 'browser_write_storage',
    description: 'Set one localStorage or sessionStorage entry.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        storage: z.enum(['local', 'session']),
        key: z.string().min(1),
        value: z.string(),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  writeStorage(input: {
    pageId?: string;
    storage: 'local' | 'session';
    key: string;
    value: string;
  }) {
    return this.withPageLock(input.pageId, () =>
      this.contextData.writeStorage(input),
    );
  }

  /** Clears cookies and both web-storage areas for the isolated context associated with the selected page. */
  @Tool({
    name: 'browser_clear_session',
    description:
      'Clear cookies, localStorage, and sessionStorage for a browser context.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
  })
  clearSession(input: { pageId?: string }) {
    return this.withPageLock(input.pageId, () =>
      this.contextData.clearSession(input.pageId),
    );
  }

  /** Sets the viewport dimensions for the selected browser page. */
  @Tool({
    name: 'browser_set_viewport',
    description: 'Set the active tab viewport size for responsive testing.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        width: z.number().int().min(320).max(7680),
        height: z.number().int().min(240).max(4320),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  viewport(input: { pageId?: string; width: number; height: number }) {
    return this.withPageLock(input.pageId, () =>
      this.artifacts.viewport(input),
    );
  }

  /** Applies the predefined desktop, mobile, or tablet viewport dimensions to the selected page. */
  @Tool({
    name: 'browser_emulate_device',
    description: 'Apply a desktop, mobile, or tablet viewport preset.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        device: z.enum(['desktop', 'mobile', 'tablet']),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  async emulate(input: {
    pageId?: string;
    device: 'desktop' | 'mobile' | 'tablet';
  }) {
    const sizes = {
      desktop: { width: 1440, height: 900 },
      mobile: { width: 390, height: 844 },
      tablet: { width: 820, height: 1180 },
    };
    const size = sizes[input.device];
    return this.withPageLock(input.pageId, async () => {
      await this.sessions.getPage(input.pageId).page.setViewportSize(size);
      return { device: input.device, ...size };
    });
  }

  /** Attaches page diagnostics when needed and returns captured requests, response metadata, and network failures. */
  @Tool({
    name: 'browser_network_logs',
    description:
      'Attach bounded request diagnostics and return captured network requests and failures.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  network(input: { pageId?: string }) {
    this.pages.attachDiagnostics(input.pageId);
    return this.pages.network(input.pageId);
  }

  /** Attaches page diagnostics and returns captured browser console messages for the selected tab. */
  @Tool({
    name: 'browser_get_console_logs',
    description:
      'Read console messages captured from the selected page. Call browser_network_logs first to attach diagnostics.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  consoleLogs(input: { pageId?: string }) {
    this.pages.attachDiagnostics(input.pageId);
    return this.pages.consoleLogs(input.pageId);
  }

  /** Returns uncaught JavaScript errors captured from the selected page, including available diagnostic details. */
  @Tool({
    name: 'browser_get_errors',
    description:
      'Read uncaught JavaScript page errors captured from the selected tab.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  errors(input: { pageId?: string }) {
    this.pages.attachDiagnostics(input.pageId);
    return this.pages.errors(input.pageId);
  }

  /** Lists page images with their source, alternative text, intrinsic dimensions, and loading state. */
  @Tool({
    name: 'browser_get_images',
    description:
      'List page images with source URLs, alt text, natural dimensions, and loading state.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  images(input: { pageId?: string }) {
    return this.pages.images(input.pageId);
  }

  /** Reads navigation timing and resource-transfer measurements exposed by the selected page. */
  @Tool({
    name: 'browser_get_performance',
    description:
      'Read navigation timing and resource transfer metrics for the current page.',
    inputSchema: z.object({ pageId: z.string().uuid().optional() }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  performance(input: { pageId?: string }) {
    return this.pages.performance(input.pageId);
  }

  /** Drags the source locator onto the target locator within the selected page. */
  @Tool({
    name: 'browser_drag_and_drop',
    description:
      'Drag one page element onto another using locator-based interaction.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        source: z.string().min(1),
        target: z.string().min(1),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  dragAndDrop(input: { pageId?: string; source: string; target: string }) {
    return this.withPageLock(input.pageId, () => this.pages.dragAndDrop(input));
  }

  /** Accepts or dismisses the most recent JavaScript dialog and supplies optional prompt text when accepting. */
  @Tool({
    name: 'browser_handle_dialog',
    description:
      'Accept or dismiss the most recent JavaScript alert, confirm, or prompt dialog.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        action: z.enum(['accept', 'dismiss']),
        promptText: z.string().optional(),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  dialog(input: {
    pageId?: string;
    action: 'accept' | 'dismiss';
    promptText?: string;
  }) {
    return this.withPageLock(input.pageId, () =>
      this.pages.handleDialog(input),
    );
  }
}
