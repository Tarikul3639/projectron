import { describe, expect, it, vi } from 'vitest';
import {
  browserLaunchSchema,
  browserNavigateSchema,
  browserScreenshotSchema,
  browserUploadSchema,
} from '../schemas/browser.schemas.js';
import { BrowserContextService } from '../services/browser-context.service.js';
import { BrowserInfoService } from '../services/browser-info.service.js';
import { BrowserSessionService } from '../services/browser-session.service.js';
import { BrowserPageService } from '../services/browser-page.service.js';
import { BrowserArtifactService } from '../services/browser-artifact.service.js';
import { BrowserDownloadService } from '../services/browser-download.service.js';
import { BrowserTools } from './browser.tools.js';

describe('BrowserTools', () => {
  it('validates bounded browser operation input contracts', () => {
    expect(
      browserLaunchSchema.safeParse({ headless: true, slowMo: 100 }).success,
    ).toBe(true);
    expect(browserLaunchSchema.safeParse({ slowMo: 3000 }).success).toBe(false);
    expect(
      browserNavigateSchema.safeParse({ url: 'https://example.com' }).success,
    ).toBe(true);
    expect(
      browserNavigateSchema.safeParse({ url: 'file:///etc/passwd' }).success,
    ).toBe(false);
    expect(
      browserScreenshotSchema.safeParse({ type: 'png', quality: 80 }).success,
    ).toBe(true);
    expect(browserScreenshotSchema.safeParse({ type: 'bmp' }).success).toBe(
      false,
    );
    expect(browserScreenshotSchema.safeParse({ quality: 101 }).success).toBe(
      false,
    );
    expect(
      browserUploadSchema.safeParse({
        selector: 'input[type=file]',
        filePaths: ['/workspace/a.txt'],
      }).success,
    ).toBe(true);
  });

  it('delegates capability discovery to the browser information service', () => {
    const info = {
      capabilities: vi.fn().mockReturnValue({ features: ['navigation'] }),
    };
    const tools = new BrowserTools(
      {} as unknown as BrowserContextService,
      info as unknown as BrowserInfoService,
      {} as unknown as BrowserSessionService,
      {} as unknown as BrowserPageService,
      {} as unknown as BrowserArtifactService,
      {} as unknown as BrowserDownloadService,
    );

    expect(tools.capabilities()).toEqual({ features: ['navigation'] });
    expect(info.capabilities).toHaveBeenCalledOnce();
  });
});
