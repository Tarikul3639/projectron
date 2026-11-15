import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DocumentFileService } from './document-file.service.js';
import { DocumentConverterService } from './document-converter.service.js';
import { WordDocumentService } from './word-document.service.js';
import { SpreadsheetDocumentService } from './spreadsheet-document.service.js';
import { PresentationDocumentService } from './presentation-document.service.js';
import { PdfDocumentService } from './pdf-document.service.js';
import type { OfficeConvertInput } from '../types/documents.type.js';

const OFFICE_RENDERERS = ['libreoffice', 'soffice', 'lowriter'] as const;
const RENDER_TIMEOUT_MS = 120_000;

/** Coordinates Office conversions and preserves native Office layout when exporting PDFs. */
@Injectable()
export class OfficeConverterService {
  constructor(
    private readonly files: DocumentFileService,
    private readonly textConverter: DocumentConverterService,
    private readonly word: WordDocumentService,
    private readonly spreadsheet: SpreadsheetDocumentService,
    private readonly presentation: PresentationDocumentService,
    private readonly pdf: PdfDocumentService,
  ) {}

  /** Converts supported Office formats; PDF export preserves layout by default. */
  async convert(input: OfficeConvertInput) {
    const source = extname(input.sourcePath).slice(1).toLowerCase();
    const target = extname(input.destinationPath).slice(1).toLowerCase();
    if (!source || !target || source === target) {
      throw new BadRequestException(
        'Source and destination must use different supported file extensions',
      );
    }
    const options = {
      overwrite: input.overwrite,
      rootIndex: input.rootIndex,
    };

    if (target === 'pdf') {
      if (!['docx', 'xlsx', 'pptx'].includes(source)) {
        throw new BadRequestException(
          'PDF export supports DOCX, XLSX, and PPTX sources only',
        );
      }
      if (input.pdfMode === 'text-first') {
        const content = await this.extractText(
          input.sourcePath,
          source,
          input.rootIndex,
        );
        const title =
          input.destinationPath.split(/[\\/]/).pop() ?? 'Converted document';
        return this.pdf.createFromText(
          input.destinationPath,
          title.replace(/\.pdf$/i, ''),
          content,
          'Projectron',
          options.overwrite,
          options.rootIndex,
        );
      }
      return this.renderPdfPreservingLayout(input, source);
    }

    if (target === 'html' && source === 'docx') {
      const result = await this.word.readHtml(
        input.sourcePath,
        input.rootIndex,
      );
      const output =
        '<!doctype html>\\n<html lang="en">\\n<head><meta charset="utf-8"></head>\\n<body>\\n' +
        result.html +
        '\\n</body>\\n</html>\\n';
      return this.files.create({
        path: input.destinationPath,
        content: output,
        overwrite: options.overwrite,
        rootIndex: options.rootIndex,
      });
    }

    if (target === 'csv' && source === 'xlsx') {
      const content = await this.spreadsheet.toCsv(
        input.sourcePath,
        input.rootIndex,
      );
      return this.files.create({
        path: input.destinationPath,
        content,
        overwrite: options.overwrite,
        rootIndex: options.rootIndex,
      });
    }

    if (target === 'json' && source === 'xlsx') {
      const value = await this.spreadsheet.toJson(
        input.sourcePath,
        input.rootIndex,
      );
      return this.files.create({
        path: input.destinationPath,
        content: JSON.stringify(value, null, 2),
        overwrite: options.overwrite,
        rootIndex: options.rootIndex,
      });
    }

    if (target === 'txt' && ['docx', 'xlsx', 'pptx', 'pdf'].includes(source)) {
      const content = await this.extractText(
        input.sourcePath,
        source,
        input.rootIndex,
      );
      return this.files.create({
        path: input.destinationPath,
        content,
        overwrite: options.overwrite,
        rootIndex: options.rootIndex,
      });
    }

    if (
      ['md', 'markdown', 'txt', 'text', 'html', 'htm', 'json', 'csv'].includes(
        source,
      ) &&
      ['md', 'markdown', 'txt', 'text', 'html', 'htm', 'json', 'csv'].includes(
        target,
      )
    ) {
      return this.textConverter.convert({
        sourcePath: input.sourcePath,
        destinationPath: input.destinationPath,
        overwrite: input.overwrite,
        rootIndex: input.rootIndex,
      });
    }

    throw new BadRequestException(
      'Conversion from .' +
        source +
        ' to .' +
        target +
        ' is not supported. Supported Office conversions: DOCX to TXT/HTML/PDF, XLSX to CSV/JSON/TXT/PDF, PPTX to TXT/PDF, PDF to TXT, and supported text formats to one another.',
    );
  }

  /**
   * Uses LibreOffice's native Office renderer. No text-only fallback is attempted
   * here: if the renderer is missing or fails, the destination is left untouched.
   */
  async renderPdfPreservingLayout(
    input: OfficeConvertInput,
    sourceFormat: string,
  ) {
    const sourceFile = await this.files.readBinary(
      input.sourcePath,
      input.rootIndex,
    );
    const renderer = await this.findOfficeRenderer();
    if (!renderer) {
      throw new BadRequestException(
        'Layout-preserving PDF export requires LibreOffice (libreoffice or soffice). No compatible renderer was found; no PDF was created. Set pdfMode="text-first" only if a simplified, non-layout-preserving PDF is acceptable.',
      );
    }

    const tempDirectory = await mkdtemp(
      join(tmpdir(), 'projectron-office-pdf-'),
    );
    const sourceName = basename(input.sourcePath);
    const tempSource = join(tempDirectory, sourceName);
    const expectedPdf = join(
      tempDirectory,
      sourceName.slice(0, -extname(sourceName).length) + '.pdf',
    );
    const profile = join(tempDirectory, 'lo-profile');

    try {
      await writeFile(tempSource, sourceFile.buffer);
      await new Promise<void>((resolve, reject) => {
        execFileCallback(
          renderer,
          [
            '--headless',
            '-env:UserInstallation=' + pathToFileURL(profile).href,
            '--convert-to',
            'pdf',
            '--outdir',
            tempDirectory,
            tempSource,
          ],
          { timeout: RENDER_TIMEOUT_MS, maxBuffer: 5 * 1024 * 1024 },
          (error, _stdout, stderr) => {
            if (error) {
              reject(
                new BadRequestException(
                  'Office renderer failed to export PDF: ' +
                    (stderr?.trim() || error.message),
                ),
              );
              return;
            }
            resolve();
          },
        );
      });

      const pdfBuffer = await readFile(expectedPdf).catch(() => {
        throw new BadRequestException(
          'Office renderer completed without producing the expected PDF file',
        );
      });
      if (!pdfBuffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
        throw new BadRequestException(
          'Office renderer output is not a valid PDF document',
        );
      }
      const written = await this.files.writeBinary(
        input.destinationPath,
        pdfBuffer,
        input.overwrite,
        input.rootIndex,
      );
      return {
        ...written,
        format: 'pdf',
        sourceFormat,
        renderer,
        layoutPreserved: true,
      };
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }

  private async findOfficeRenderer(): Promise<string | undefined> {
    for (const renderer of OFFICE_RENDERERS) {
      const available = await new Promise<boolean>((resolve) => {
        execFileCallback(
          renderer,
          ['--version'],
          { timeout: 10_000, maxBuffer: 1024 * 1024 },
          (error) => resolve(!error),
        );
      });
      if (available) return renderer;
    }
    return undefined;
  }

  private async extractText(
    path: string,
    format: string,
    rootIndex = 0,
  ): Promise<string> {
    if (format === 'docx') {
      const result = await this.word.read(path, rootIndex, 500_000);
      return result.content;
    }
    if (format === 'xlsx') {
      const result = await this.spreadsheet.read(path, rootIndex, 10000);
      return result.sheets
        .map((sheet) =>
          [
            sheet.name,
            sheet.headers.join(' | '),
            ...sheet.rows.map((row) => row.join(' | ')),
          ].join('\\n'),
        )
        .join('\\n\\n');
    }
    if (format === 'pptx') {
      return (await this.presentation.read(path, rootIndex, 500_000)).content;
    }
    if (format === 'pdf') {
      return (await this.pdf.read(path, rootIndex, 500_000)).content;
    }
    if (
      ['md', 'markdown', 'txt', 'text', 'html', 'htm', 'json', 'csv'].includes(
        format,
      )
    ) {
      return (
        await this.files.read({ path, rootIndex, maxCharacters: 500_000 })
      ).content;
    }
    throw new BadRequestException('Unsupported source format: .' + format);
  }
}
