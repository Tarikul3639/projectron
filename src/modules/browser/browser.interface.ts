// Defines the public browser session and page operations shared by module services.
export interface BrowserLaunchOptions {
  headless?: boolean;
  slowMo?: number;
  timeoutMs?: number;
}

export interface BrowserNavigateOptions {
  url: string;
  pageId?: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeoutMs?: number;
}

export interface BrowserScreenshotOptions {
  pageId?: string;
  fullPage?: boolean;
  selector?: string;
  path?: string;
  type?: 'png' | 'jpeg';
  quality?: number;
}
