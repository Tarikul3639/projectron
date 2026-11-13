import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type Download, type Page } from 'playwright';
import type {
  BrowserDownloadRecord,
  BrowserPage,
  BrowserPageSummary,
  BrowserSession,
} from '../types/browser.type.js';
import type { BrowserLaunchOptions } from '../interfaces/browser.interface.js';

// Owns Chromium, isolated contexts, tabs, and the in-memory download registry.
/** Provides the browser session functionality for this module. */
@Injectable()
export class BrowserSessionService implements OnModuleDestroy {
  private browser?: Browser;
  private readonly sessions = new Map<string, BrowserSession>();
  private readonly pages = new Map<string, BrowserPage>();
  private readonly downloads = new Map<string, BrowserDownloadRecord>();
  private defaultPageId?: string;

  /** Launches Chromium once; each logical session receives an isolated context. */
  async launch(options: BrowserLaunchOptions = {}) {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: options.headless ?? true,
        slowMo: options.slowMo ?? 0,
        timeout: options.timeoutMs ?? 30_000,
        args: ['--disable-dev-shm-usage'],
      });
      this.browser.on('disconnected', () => {
        this.sessions.clear();
        this.pages.clear();
        this.defaultPageId = undefined;
      });
    }
    const session = await this.createSession();
    return {
      browser: 'chromium',
      connected: true,
      sessionId: session.id,
      ...this.sessionSummary(session),
    };
  }

  /** Creates a fresh context with downloads enabled and a separate cookie/storage jar. */
  async createSession(): Promise<BrowserSession> {
    await this.ensureBrowser();
    const context = await this.browser!.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 900 },
      serviceWorkers: 'block',
    });
    const session: BrowserSession = {
      id: randomUUID(),
      context,
      createdAt: Date.now(),
    };
    this.sessions.set(session.id, session);
    this.registerPage(session, await context.newPage());
    return session;
  }

  /** Creates another tab inside an existing isolated session. */
  async createPage(sessionId?: string) {
    const session = sessionId
      ? this.getSession(sessionId)
      : this.getDefaultSession();
    return this.registerPage(session, await session.context.newPage());
  }

  /** Resolves a page ID or the current default tab. */
  getPage(pageId?: string): BrowserPage {
    const id = pageId ?? this.defaultPageId;
    if (!id)
      throw new NotFoundException(
        'No browser page is open; launch the browser first',
      );
    const record = this.pages.get(id);
    if (!record || record.page.isClosed())
      throw new NotFoundException('Browser page not found or already closed');
    return record;
  }

  /** Resolves an isolated browser context by ID. */
  getSession(sessionId: string): BrowserSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException('Browser session not found');
    return session;
  }

  /** Returns all tabs with their current URL and title. */
  async listPages(): Promise<BrowserPageSummary[]> {
    const rows: BrowserPageSummary[] = [];
    for (const item of this.pages.values())
      if (!item.page.isClosed())
        rows.push({
          id: item.id,
          sessionId: item.sessionId,
          url: item.page.url(),
          title: await item.page.title(),
          isClosed: false,
        });
    return rows;
  }

  /** Returns non-sensitive session metadata without exposing browser internals. */
  listSessions() {
    return [...this.sessions.values()].map((session) => ({
      id: session.id,
      ...this.sessionSummary(session),
    }));
  }

  /** Closes one tab and selects another live tab as the default. */
  async closePage(pageId?: string) {
    const record = this.getPage(pageId);
    await record.page.close();
    this.pages.delete(record.id);
    if (this.defaultPageId === record.id)
      this.defaultPageId = [...this.pages.values()].find(
        (x) => !x.page.isClosed(),
      )?.id;
    return { closed: record.id, defaultPageId: this.defaultPageId ?? null };
  }

  /** Closes one isolated context and all its tabs. */
  async closeSession(sessionId: string) {
    const session = this.getSession(sessionId);
    await session.context.close();
    this.sessions.delete(sessionId);
    for (const [id, page] of this.pages)
      if (page.sessionId === sessionId) this.pages.delete(id);
    for (const [id, download] of this.downloads)
      if (download.sessionId === sessionId) this.downloads.delete(id);
    this.defaultPageId = [...this.pages.values()].find(
      (x) => !x.page.isClosed(),
    )?.id;
    return { closedSessionId: sessionId };
  }

  /** Closes every context and the Chromium process. */
  async close() {
    for (const session of this.sessions.values())
      await session.context.close().catch(() => undefined);
    this.sessions.clear();
    this.pages.clear();
    this.downloads.clear();
    this.defaultPageId = undefined;
    if (this.browser?.isConnected()) await this.browser.close();
    this.browser = undefined;
    return { closed: true };
  }

  /** Stores a download so later tools can inspect or save it. */
  registerDownload(
    sessionId: string,
    pageId: string,
    download: Download,
  ): BrowserDownloadRecord {
    const record: BrowserDownloadRecord = {
      id: randomUUID(),
      sessionId,
      pageId,
      suggestedFilename: download.suggestedFilename(),
      url: download.url(),
      startedAt: Date.now(),
      download,
    };
    this.downloads.set(record.id, record);
    return record;
  }

  /** Finds a download captured by this Projectron process. */
  getDownload(downloadId: string) {
    const record = this.downloads.get(downloadId);
    if (!record) throw new NotFoundException('Browser download not found');
    return record;
  }

  /** Lists download metadata without exposing temporary paths. */
  listDownloads() {
    return [...this.downloads.values()].map(
      ({ id, sessionId, pageId, suggestedFilename, url, startedAt }) => ({
        id,
        sessionId,
        pageId,
        suggestedFilename,
        url,
        startedAt,
      }),
    );
  }

  /** Handles on module destroy for the component. */
  async onModuleDestroy() {
    await this.close();
  }

  /** Handles ensure browser for the component. */
  private async ensureBrowser() {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--disable-dev-shm-usage'],
      });
      this.browser.on('disconnected', () => {
        this.sessions.clear();
        this.pages.clear();
        this.defaultPageId = undefined;
      });
    }
  }
  /** Handles register page for the component. */
  private registerPage(session: BrowserSession, page: Page): BrowserPage {
    const record: BrowserPage = {
      id: randomUUID(),
      sessionId: session.id,
      page,
      createdAt: Date.now(),
    };
    this.pages.set(record.id, record);
    this.defaultPageId = record.id;
    page.on('download', (download) =>
      this.registerDownload(session.id, record.id, download),
    );
    page.on('popup', (popup) => this.registerPage(session, popup));
    return record;
  }
  /** Returns default session from the service. */
  private getDefaultSession() {
    return this.getSession(this.getPage().sessionId);
  }
  /** Handles session summary for the component. */
  private sessionSummary(session: BrowserSession) {
    return {
      createdAt: session.createdAt,
      pages: [...this.pages.values()].filter(
        (page) => page.sessionId === session.id && !page.page.isClosed(),
      ).length,
    };
  }
}
