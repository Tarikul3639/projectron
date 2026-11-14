import { BadRequestException, Injectable } from '@nestjs/common';
import { extname } from 'node:path';
import { DocumentFileService } from './document-file.service.js';
import { DocumentConverterService } from './document-converter.service.js';
import { WordDocumentService } from './word-document.service.js';
import { SpreadsheetDocumentService } from './spreadsheet-document.service.js';
import { PresentationDocumentService } from './presentation-document.service.js';
import { PdfDocumentService } from './pdf-document.service.js';
import type { OfficeConvertInput } from '../types/documents.type.js';

/** Coordinates explicit conversions between supported Office and text formats. */
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

  /** Converts supported Office formats to TXT, HTML, CSV, JSON, or a text-first PDF. */
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
      if (source === 'pdf') {
        throw new BadRequestException('PDF-to-PDF conversion is not supported');
      }
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
        ' is not supported. Supported Office conversions: DOCX to TXT/HTML/PDF; XLSX to CSV/JSON/TXT/PDF; PPTX to TXT/PDF; PDF to TXT.',
    );
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
