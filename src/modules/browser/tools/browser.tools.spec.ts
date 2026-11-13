import { describe, expect, it } from 'vitest';
import {
  browserLaunchSchema,
  browserNavigateSchema,
  browserScreenshotSchema,
  browserUploadSchema,
} from '../schemas/browser.schemas.js';

// Verifies MCP input validation and bounded browser operation parameters.
describe('Browser MCP schemas', () => {
  it('accepts bounded Chromium launch options', () => {
    expect(
      browserLaunchSchema.safeParse({ headless: true, slowMo: 100 }).success,
    ).toBe(true);
    expect(browserLaunchSchema.safeParse({ slowMo: 3000 }).success).toBe(false);
  });

  it('only accepts HTTP and HTTPS navigation URLs', () => {
    expect(
      browserNavigateSchema.safeParse({ url: 'https://example.com' }).success,
    ).toBe(true);
    expect(
      browserNavigateSchema.safeParse({ url: 'file:///etc/passwd' }).success,
    ).toBe(false);
  });

  it('validates screenshot output formats and quality bounds', () => {
    expect(
      browserScreenshotSchema.safeParse({ type: 'png', quality: 80 }).success,
    ).toBe(true);
    expect(browserScreenshotSchema.safeParse({ type: 'bmp' }).success).toBe(
      false,
    );
    expect(browserScreenshotSchema.safeParse({ quality: 101 }).success).toBe(
      false,
    );
  });

  it('requires a client identity for local file upload approval', () => {
    expect(
      browserUploadSchema.safeParse({
        selector: 'input[type=file]',
        filePaths: ['/workspace/a.txt'],
        clientId: 'test-client',
      }).success,
    ).toBe(true);
    expect(
      browserUploadSchema.safeParse({
        selector: 'input[type=file]',
        filePaths: ['/workspace/a.txt'],
      }).success,
    ).toBe(false);
  });
});
