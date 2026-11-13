import { BadRequestException, Injectable } from '@nestjs/common';
import { lstat, mkdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { AppConfigService } from '../../../config/config.service.js';
import { BrowserSessionService } from './browser-session.service.js';

// Produces screenshots, PDFs, traces, and viewport emulation artifacts.
@Injectable()
export class BrowserArtifactService {
  constructor(
    private readonly sessions: BrowserSessionService,
    private readonly config: AppConfigService,
  ) {}

  /** Captures the viewport, full page, or a selected element and optionally saves it. */
  async screenshot(input: {
    pageId?: string;
    fullPage?: boolean;
    selector?: string;
    path?: string;
    type?: 'png' | 'jpeg';
    quality?: number;
  }) {
    const page = this.sessions.getPage(input.pageId).page;
    const options = {
      type: input.type ?? 'png',
      fullPage: input.fullPage ?? false,
      ...(input.quality ? { quality: input.quality } : {}),
    } as const;
    if (!input.path) {
      const buffer = input.selector
        ? await page.locator(input.selector).screenshot(options)
        : await page.screenshot(options);
      return {
        mimeType: input.type === 'jpeg' ? 'image/jpeg' : 'image/png',
        base64: buffer.toString('base64'),
        bytes: buffer.length,
      };
    }
    const path = await this.resolveAllowedPath(input.path);
    await mkdir(dirname(path), { recursive: true });
    await this.assertParentIsAllowed(path);
    await this.assertPathAvailable(path);
    if (input.selector)
      await page.locator(input.selector).screenshot({ ...options, path });
    else await page.screenshot({ ...options, path });
    return {
      path,
      mimeType: input.type === 'jpeg' ? 'image/jpeg' : 'image/png',
    };
  }

  /** Prints the current webpage to PDF in an allowed workspace directory. */
  async pdf(pageId: string | undefined, pathValue: string) {
    const path = await this.resolveAllowedPath(pathValue);
    await mkdir(dirname(path), { recursive: true });
    await this.assertParentIsAllowed(path);
    await this.assertPathAvailable(path);
    await this.sessions.getPage(pageId).page.pdf({
      path,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    return { path, format: 'A4' };
  }

  /** Starts tracing for the browser context that owns the selected page. */
  async traceStart(pageId?: string) {
    const session = this.sessions.getSession(
      this.sessions.getPage(pageId).sessionId,
    );
    await session.context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
    return { tracing: true, sessionId: session.id };
  }

  /** Stops tracing and writes the archive inside an allowed workspace. */
  async traceStop(pageId: string | undefined, pathValue: string) {
    const session = this.sessions.getSession(
      this.sessions.getPage(pageId).sessionId,
    );
    const path = await this.resolveAllowedPath(pathValue);
    await mkdir(dirname(path), { recursive: true });
    await this.assertParentIsAllowed(path);
    await this.assertPathAvailable(path);
    await session.context.tracing.stop({ path });
    return { tracing: false, path };
  }

  /** Sets the viewport dimensions for responsive-layout inspection. */
  async viewport(input: { pageId?: string; width: number; height: number }) {
    await this.sessions
      .getPage(input.pageId)
      .page.setViewportSize({ width: input.width, height: input.height });
    return { width: input.width, height: input.height };
  }

  /** Prevents screenshots, PDFs, or traces from silently replacing an existing artifact. */
  private async assertPathAvailable(path: string) {
    const existing = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (existing)
      throw new BadRequestException(
        'Artifact already exists; choose a new output path',
      );
  }

  /** Confirms the real parent directory remains inside an allowed root after symlink resolution. */
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
          !isAbsolute(relativePath))
      )
        return;
    }
    throw new BadRequestException(
      'Artifact destination resolves outside configured filesystem roots',
    );
  }

  /** Resolves artifact destinations beneath a configured filesystem root. */
  private async resolveAllowedPath(value: string) {
    if (!isAbsolute(value))
      throw new BadRequestException('Artifact path must be absolute');
    const target = resolve(value);
    for (const configured of this.config.filesystemAllowedRoots.split(':')) {
      const root = await realpath(resolve(configured.trim())).catch(
        () => undefined,
      );
      if (!root) continue;
      const relativePath = relative(root, target);
      if (
        relativePath === '' ||
        (relativePath !== '..' &&
          !relativePath.startsWith('..' + sep) &&
          !isAbsolute(relativePath))
      )
        return target;
    }
    throw new BadRequestException(
      'Artifact path must stay inside a configured filesystem root',
    );
  }
}
