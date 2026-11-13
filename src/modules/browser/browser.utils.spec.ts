import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { assertSafeBrowserUrl } from './browser.utils.js';

// Covers browser URL policy independently of launching a real Chromium process.
describe('assertSafeBrowserUrl', () => {
  it('allows HTTP and HTTPS loopback URLs for local development', async () => {
    await expect(
      assertSafeBrowserUrl('http://127.0.0.1:3000'),
    ).resolves.toBeInstanceOf(URL);
    await expect(
      assertSafeBrowserUrl('http://localhost:5173'),
    ).resolves.toBeInstanceOf(URL);
  });

  it('rejects non-web protocols', async () => {
    await expect(
      assertSafeBrowserUrl('file:///etc/passwd'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      assertSafeBrowserUrl('javascript:alert(1)'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects embedded credentials', async () => {
    await expect(
      assertSafeBrowserUrl('https://user:password@example.com'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects private LAN and link-local destinations', async () => {
    await expect(
      assertSafeBrowserUrl('http://10.0.0.5'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      assertSafeBrowserUrl('http://192.168.1.1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      assertSafeBrowserUrl('http://169.254.169.254'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects malformed URLs', async () => {
    await expect(assertSafeBrowserUrl('not-a-url')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
