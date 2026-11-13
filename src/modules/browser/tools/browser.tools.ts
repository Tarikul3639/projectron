import { Injectable } from '@nestjs/common';
import { Tool, type McpContext } from '@nestjs/mcp';
import * as z from 'zod';
import { McpApprovalService } from '../../approval/services/mcp-approval.service.js';
import { BrowserContextService } from '../services/browser-context.service.js';
import { BrowserInfoService } from '../services/browser-info.service.js';
import { BrowserSessionService } from '../services/browser-session.service.js';
import { BrowserPageService } from '../services/browser-page.service.js';
import { BrowserArtifactService } from '../services/browser-artifact.service.js';
import { BrowserDownloadService } from '../services/browser-download.service.js';

/** Publishes browser automation tools and collects explicit user approval for sensitive actions. */
@Injectable()
export class BrowserTools {
  /** Initializes the tool handlers and their dependencies. */
  constructor(
    private readonly contextData: BrowserContextService,
    private readonly browserInfo: BrowserInfoService,
    private readonly sessions: BrowserSessionService,
    private readonly pages: BrowserPageService,
    private readonly artifacts: BrowserArtifactService,
    private readonly downloads: BrowserDownloadService,
    private readonly approvalHandler: McpApprovalService,
  ) {}

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
    return this.sessions.launch(input);
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
    return this.sessions.close();
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
    const session = await this.sessions.createSession();
    return { sessionId: session.id, createdAt: session.createdAt };
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
    const page = await this.sessions.createPage(input.sessionId);
    return { pageId: page.id, sessionId: page.sessionId };
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
    return this.sessions.closePage(input.pageId);
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
    return this.sessions.closeSession(input.sessionId);
  }

  /** Handles navigate for the component. */
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
    return this.pages.navigate(input);
  }

  /** Handles back for the component. */
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
    return this.pages.history(input.pageId, 'back');
  }

  /** Handles forward for the component. */
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
    return this.pages.history(input.pageId, 'forward');
  }

  /** Handles reload for the component. */
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
    return this.pages.reload(input.pageId);
  }

  /** Handles page info for the component. */
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

  /** Returns text from the service. */
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

  /** Returns html from the service. */
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

  /** Returns dom from the service. */
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

  /** Handles accessibility for the component. */
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

  /** Handles links for the component. */
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

  /** Handles wait for for the component. */
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

  /** Handles wait url for the component. */
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

  /** Handles interact for the component. */
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
    return this.pages.interact(input);
  }

  /** Handles select for the component. */
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
    return this.pages.interact({ ...input, action: 'select' });
  }

  /** Handles press for the component. */
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
    return this.pages.press(input);
  }

  /** Handles scroll for the component. */
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
    return this.pages.scroll(input);
  }

  /** Handles screenshot for the component. */
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

  /** Handles upload for the component. */
  @Tool({
    name: 'browser_upload_file',
    description:
      'Upload local files to a webpage input. Requires explicit user approval; source files must be inside configured workspace roots.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        selector: z.string().min(1),
        filePaths: z.array(z.string().min(1)).min(1).max(20),
        clientId: z.string().min(1).max(128),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  upload(
    input: {
      pageId?: string;
      selector: string;
      filePaths: string[];
      clientId: string;
    },
    context: McpContext,
  ) {
    return this.approvalHandler.run(
      'browser',
      'Upload local files to a webpage',
      input,
      context,
      () => this.contextData.upload(input),
    );
  }

  /** Handles download for the component. */
  @Tool({
    name: 'browser_download',
    description:
      'Click a download link or button and capture its download record. Requires explicit user approval.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        selector: z.string().min(1),
        clientId: z.string().min(1).max(128),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  download(
    input: { pageId?: string; selector: string; clientId: string },
    context: McpContext,
  ) {
    return this.approvalHandler.run(
      'browser',
      'Download a file from a webpage',
      input,
      context,
      () => this.downloads.trigger(input),
    );
  }

  /** Returns downloads from the service. */
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

  /** Handles wait download for the component. */
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

  /** Handles save download for the component. */
  @Tool({
    name: 'browser_save_download',
    description:
      'Save a captured download to an absolute path inside an allowed workspace. Requires explicit user approval.',
    inputSchema: z
      .object({
        downloadId: z.string().uuid(),
        path: z.string().min(1),
        clientId: z.string().min(1).max(128),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  saveDownload(
    input: { downloadId: string; path: string; clientId: string },
    context: McpContext,
  ) {
    return this.approvalHandler.run(
      'browser',
      'Save browser download to ' + input.path,
      input,
      context,
      () => this.downloads.save(input.downloadId, input.path),
    );
  }

  /** Handles cancel download for the component. */
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

  /** Handles pdf for the component. */
  @Tool({
    name: 'browser_print_to_pdf',
    description:
      'Print the current page to PDF inside an allowed workspace. Requires explicit user approval.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        path: z.string().min(1),
        clientId: z.string().min(1).max(128),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  pdf(
    input: { pageId?: string; path: string; clientId: string },
    context: McpContext,
  ) {
    return this.approvalHandler.run(
      'browser',
      'Print webpage to PDF at ' + input.path,
      input,
      context,
      () => this.artifacts.pdf(input.pageId, input.path),
    );
  }

  /** Handles trace start for the component. */
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
    return this.artifacts.traceStart(input.pageId);
  }

  /** Handles trace stop for the component. */
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
    return this.artifacts.traceStop(input.pageId, input.path);
  }

  /** Evaluates JavaScript in the selected page after explicit approval. */
  @Tool({
    name: 'browser_evaluate',
    description:
      'Execute JavaScript in the selected page context. This is powerful and requires explicit user approval; do not use it when a safe locator tool is sufficient.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        expression: z.string().min(1).max(20000),
        clientId: z.string().min(1).max(128),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  evaluate(
    input: { pageId?: string; expression: string; clientId: string },
    context: McpContext,
  ) {
    return this.approvalHandler.run(
      'browser',
      'Execute JavaScript in browser page',
      input,
      context,
      () => this.contextData.evaluate(input),
    );
  }

  /** Handles cookies for the component. */
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

  /** Handles set cookies for the component. */
  @Tool({
    name: 'browser_set_cookies',
    description:
      'Set cookies in the selected isolated browser context. Requires explicit user approval.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        cookies: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
        clientId: z.string().min(1).max(128),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  setCookies(
    input: {
      pageId?: string;
      cookies: Array<Record<string, unknown>>;
      clientId: string;
    },
    context: McpContext,
  ) {
    return this.approvalHandler.run(
      'browser',
      'Modify browser cookies',
      input,
      context,
      () => this.contextData.setCookies(input),
    );
  }

  /** Reads storage and returns the requested content. */
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

  /** Writes storage to the requested destination. */
  @Tool({
    name: 'browser_write_storage',
    description:
      'Set one localStorage or sessionStorage entry. Requires explicit user approval.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        storage: z.enum(['local', 'session']),
        key: z.string().min(1),
        value: z.string(),
        clientId: z.string().min(1).max(128),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  writeStorage(
    input: {
      pageId?: string;
      storage: 'local' | 'session';
      key: string;
      value: string;
      clientId: string;
    },
    context: McpContext,
  ) {
    return this.approvalHandler.run(
      'browser',
      'Modify browser web storage',
      input,
      context,
      () => this.contextData.writeStorage(input),
    );
  }

  /** Clears session. */
  @Tool({
    name: 'browser_clear_session',
    description:
      'Clear cookies, localStorage, and sessionStorage for a browser context. Requires explicit user approval.',
    inputSchema: z
      .object({
        pageId: z.string().uuid().optional(),
        clientId: z.string().min(1).max(128),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
  })
  clearSession(
    input: { pageId?: string; clientId: string },
    context: McpContext,
  ) {
    return this.approvalHandler.run(
      'browser',
      'Clear browser session cookies and storage',
      input,
      context,
      () => this.contextData.clearSession(input.pageId),
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
    return this.artifacts.viewport(input);
  }

  /** Handles emulate for the component. */
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
    await this.sessions.getPage(input.pageId).page.setViewportSize(size);
    return { device: input.device, ...size };
  }

  /** Handles network for the component. */
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

  /** Handles console logs for the component. */
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

  /** Handles errors for the component. */
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

  /** Handles images for the component. */
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

  /** Handles performance for the component. */
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

  /** Handles drag and drop for the component. */
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
    return this.pages.dragAndDrop(input);
  }

  /** Handles dialog for the component. */
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
    return this.pages.handleDialog(input);
  }
}
