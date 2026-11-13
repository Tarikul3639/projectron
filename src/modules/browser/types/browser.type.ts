import type { BrowserContext, Download, Page } from 'playwright';

// Describes the runtime records used to manage isolated browser contexts, tabs, and downloads.
export interface BrowserSession {
  id: string;
  context: BrowserContext;
  createdAt: number;
}
export interface BrowserPage {
  id: string;
  sessionId: string;
  page: Page;
  createdAt: number;
}
export interface BrowserDownloadRecord {
  id: string;
  sessionId: string;
  pageId: string;
  suggestedFilename: string;
  url: string;
  startedAt: number;
  download: Download;
}
export interface BrowserPageSummary {
  id: string;
  sessionId: string;
  url: string;
  title: string;
  isClosed: boolean;
}
