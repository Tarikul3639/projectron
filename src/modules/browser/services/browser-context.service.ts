import { BadRequestException, Injectable } from '@nestjs/common';
import { stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { realpath } from 'node:fs/promises';
import { AppConfigService } from '../../../config/config.service.js';
import { BrowserSessionService } from './browser-session.service.js';

/** Manages page evaluation, isolated context data, and approved local file uploads. */
@Injectable()
export class BrowserContextService {
  constructor(
    private readonly sessions: BrowserSessionService,
    private readonly config: AppConfigService,
  ) {}

  /** Evaluates a bounded expression in the selected page. */
  async evaluate(input: { pageId?: string; expression: string }) {
    if (input.expression.length > 20000)
      throw new BadRequestException('Browser expression is too large');
    return this.sessions
      .getPage(input.pageId)
      .page.evaluate((source) => (0, eval)(source), input.expression);
  }

  /** Reads cookies while redacting their values. */
  async cookies(pageId?: string) {
    const page = this.sessions.getPage(pageId);
    const cookies = await page.page.context().cookies();
    return cookies.map((cookie) => ({ ...cookie, value: '[REDACTED]' }));
  }

  /** Adds cookies to one isolated browser context. */
  async setCookies(input: {
    pageId?: string;
    cookies: Array<Record<string, unknown>>;
  }) {
    const page = this.sessions.getPage(input.pageId);
    await page.page.context().addCookies(input.cookies as never[]);
    return { added: input.cookies.length };
  }

  /** Reads local or session storage and redacts likely credentials. */
  async readStorage(input: { pageId?: string; storage: 'local' | 'session' }) {
    return this.sessions.getPage(input.pageId).page.evaluate((kind) => {
      const store = kind === 'local' ? localStorage : sessionStorage;
      return Object.fromEntries(
        Object.keys(store).map((key) => [
          key,
          /token|secret|password|authorization|auth/i.test(key)
            ? '[REDACTED]'
            : store.getItem(key),
        ]),
      );
    }, input.storage);
  }

  /** Updates one storage key in the selected page origin. */
  async writeStorage(input: {
    pageId?: string;
    storage: 'local' | 'session';
    key: string;
    value: string;
  }) {
    await this.sessions.getPage(input.pageId).page.evaluate(
      ({ kind, key, value }) => {
        (kind === 'local' ? localStorage : sessionStorage).setItem(key, value);
      },
      { kind: input.storage, key: input.key, value: input.value },
    );
    return { storage: input.storage, key: input.key, updated: true };
  }

  /** Clears cookies and web storage for the selected isolated context. */
  async clearSession(pageId?: string) {
    const record = this.sessions.getPage(pageId);
    await record.page.context().clearCookies();
    await record.page
      .evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      })
      .catch(() => undefined);
    return { sessionId: record.sessionId, cleared: true };
  }

  /** Uploads only regular files resolved inside configured workspace roots. */
  async upload(input: {
    pageId?: string;
    selector: string;
    filePaths: string[];
  }) {
    const files: string[] = [];
    for (const value of input.filePaths) {
      if (!isAbsolute(value))
        throw new BadRequestException('Upload paths must be absolute');
      const actualPath = await realpath(resolve(value));
      const allowed = await Promise.all(
        this.config.filesystemAllowedRoots.split(':').map(async (root) => {
          const base = await realpath(resolve(root.trim())).catch(
            () => undefined,
          );
          if (!base) return false;
          const relativePath = relative(base, actualPath);
          return (
            relativePath === '' ||
            (relativePath !== '..' &&
              !relativePath.startsWith('..' + sep) &&
              !relativePath.startsWith(sep))
          );
        }),
      );
      if (!allowed.some(Boolean))
        throw new BadRequestException(
          'Upload source must stay inside a configured filesystem root',
        );
      if (!(await stat(actualPath)).isFile())
        throw new BadRequestException('Upload source must be a regular file');
      files.push(actualPath);
    }
    await this.sessions
      .getPage(input.pageId)
      .page.locator(input.selector)
      .setInputFiles(files);
    return {
      uploaded: files.length,
      filenames: files.map((path) => path.split('/').pop()),
    };
  }
}
