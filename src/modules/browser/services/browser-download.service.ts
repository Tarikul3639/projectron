import { BadRequestException, Injectable } from '@nestjs/common';
import { lstat, mkdir, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { AppConfigService } from '../../../config/config.service.js';
import { BrowserSessionService } from './browser-session.service.js';

// Saves browser downloads only inside configured workspace roots.
/** Provides the browser download functionality for this module. */
@Injectable()
export class BrowserDownloadService {
  /** Creates the service and initializes its dependencies. */
  constructor(
    private readonly sessions: BrowserSessionService,
    private readonly config: AppConfigService,
  ) {}

  /** Clicks a page locator and returns the download record captured by the session. */
  async trigger(input: { pageId?: string; selector: string }) {
    const pageRecord = this.sessions.getPage(input.pageId);
    const [download] = await Promise.all([
      pageRecord.page.waitForEvent('download'),
      pageRecord.page.locator(input.selector).click(),
    ]);
    const record = this.sessions
      .listDownloads()
      .find(
        (item) =>
          item.pageId === pageRecord.id &&
          item.url === download.url() &&
          item.startedAt >= Date.now() - 10000,
      );
    if (!record)
      throw new BadRequestException('Download event could not be registered');
    return {
      downloadId: record.id,
      filename: record.suggestedFilename,
      url: record.url,
    };
  }

  /** Saves a completed browser download to a destination inside an allowed workspace. */
  async save(downloadId: string, destination: string) {
    const record = this.sessions.getDownload(downloadId);
    const target = await this.resolveAllowedPath(destination);
    await mkdir(dirname(target), { recursive: true });
    await this.assertParentIsAllowed(target);
    const existing = await lstat(target).catch(() => undefined);
    if (existing?.isSymbolicLink())
      throw new BadRequestException(
        'Download destination cannot be a symbolic link',
      );
    await record.download.saveAs(target);
    const metadata = await stat(target);
    return {
      downloadId,
      path: target,
      filename: record.suggestedFilename,
      size: metadata.size,
      url: record.url,
    };
  }

  /** Waits for the selected download to finish and reports its status. */
  async wait(downloadId: string) {
    const record = this.sessions.getDownload(downloadId);
    const failure = await record.download.failure();
    return {
      downloadId,
      filename: record.suggestedFilename,
      url: record.url,
      status: failure ? 'failed' : 'completed',
      failure,
    };
  }

  /** Lists download metadata without exposing temporary filesystem locations. */
  list() {
    return this.sessions.listDownloads();
  }

  /** Cancels a pending download while Playwright still controls its transfer. */
  async cancel(downloadId: string) {
    await this.sessions.getDownload(downloadId).download.cancel();
    return { downloadId, cancelled: true };
  }

  /** Resolves existing parent symlinks and confirms the real destination remains in a workspace. */
  private async assertParentIsAllowed(target: string) {
    const parent = await realpath(dirname(target));
    for (const configured of this.config.filesystemAllowedRoots.split(':')) {
      const root = await realpath(resolve(configured.trim())).catch(
        () => undefined,
      );
      if (!root) continue;
      const relativePath = relative(root, parent);
      if (
        relativePath === '' ||
        (relativePath !== '..' &&
          !relativePath.startsWith('..' + sep) &&
          !relativePath.startsWith(sep))
      )
        return;
    }
    throw new BadRequestException(
      'Download destination resolves outside configured filesystem roots',
    );
  }

  /** Resolves a destination beneath a configured filesystem root and rejects traversal. */
  private async resolveAllowedPath(value: string) {
    if (!isAbsolute(value))
      throw new BadRequestException(
        'Download destination must be an absolute path',
      );
    const target = resolve(value);
    const roots = this.config.filesystemAllowedRoots
      .split(':')
      .map((root) => resolve(root.trim()))
      .filter(Boolean);
    for (const root of roots) {
      const realRoot = await import('node:fs/promises')
        .then((fs) => fs.realpath(root))
        .catch(() => undefined);
      if (!realRoot) continue;
      const relativePath = relative(realRoot, target);
      if (
        relativePath === '' ||
        (relativePath !== '..' &&
          !relativePath.startsWith('..' + sep) &&
          !relativePath.startsWith(sep))
      )
        return target;
    }
    throw new BadRequestException(
      'Download destination must stay inside a configured filesystem root',
    );
  }
}
