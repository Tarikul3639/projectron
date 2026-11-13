import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentFileService } from './document-file.service.js';
import type { DocumentConvertInput } from '../types/documents.type.js';
import { getDocumentFormat } from '../utils/documents.utils.js';

/** Converts between supported text-based document formats without external executables. */
@Injectable()
export class DocumentConverterService {
  /** Creates the service and initializes its dependencies. */
  constructor(private readonly files: DocumentFileService) {}

  /** Reads a source document, converts its content, and writes the destination document. */
  async convert(input: DocumentConvertInput) {
    const source = await this.files.read({
      path: input.sourcePath,
      rootIndex: input.rootIndex,
      maxCharacters: 500_000,
    });
    const targetFormat = getDocumentFormat(input.destinationPath);
    const content = this.convertContent(
      source.content,
      source.format,
      targetFormat,
    );
    return this.files.create({
      path: input.destinationPath,
      content,
      overwrite: input.overwrite,
      clientId: input.clientId,
      rootIndex: input.rootIndex,
    });
  }

  /** Applies explicit deterministic conversions supported by Projectron. */
  private convertContent(
    content: string,
    source: string,
    target: string,
  ): string {
    if (source === target) return content;
    if (target === 'txt' || target === 'text')
      return this.toPlainText(content, source);
    if (target === 'md' || target === 'markdown') {
      if (source === 'html' || source === 'htm')
        return this.htmlToText(content);
      return content;
    }
    if (target === 'html' || target === 'htm')
      return this.markdownToHtml(content);
    if (target === 'json' && source === 'csv')
      return JSON.stringify(this.csvToObjects(content), null, 2);
    if (target === 'csv' && source === 'json')
      return this.objectsToCsv(content);
    throw new BadRequestException(
      'Conversion from .' + source + ' to .' + target + ' is not supported',
    );
  }

  /** Escapes Markdown text before embedding it in a minimal HTML document. */
  private markdownToHtml(markdown: string): string {
    const escape = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const lines = markdown.split(/\r?\n/);
    const html: string[] = [];
    let inList = false;
    for (const line of lines) {
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      const item = /^\s*[-*+]\s+(.+)$/.exec(line);
      if (item) {
        if (!inList) {
          html.push('<ul>');
          inList = true;
        }
        html.push('<li>' + escape(item[1]) + '</li>');
        continue;
      }
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      if (heading)
        html.push(
          '<h' +
            heading[1].length +
            '>' +
            escape(heading[2]) +
            '</h' +
            heading[1].length +
            '>',
        );
      else if (line.trim()) html.push('<p>' + escape(line) + '</p>');
    }
    if (inList) html.push('</ul>');
    return (
      '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Document</title></head>\n<body>\n' +
      html.join('\n') +
      '\n</body>\n</html>\n'
    );
  }

  /** Removes markup and decodes common entities for a readable plain-text result. */
  private htmlToText(html: string): string {
    return html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Strips common Markdown syntax while retaining readable text. */
  private toPlainText(content: string, source: string): string {
    if (source === 'html' || source === 'htm') return this.htmlToText(content);
    if (source === 'md' || source === 'markdown') {
      return content
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '• ')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)')
        .replace(/\x60{1,3}/g, '');
    }
    if (source === 'json') return JSON.stringify(JSON.parse(content), null, 2);
    return content;
  }

  /** Parses CSV rows into objects using the first row as column names. */
  private csvToObjects(csv: string): Array<Record<string, string>> {
    const rows = this.parseCsv(csv);
    if (!rows.length) return [];
    const headers = rows[0];
    return rows
      .slice(1)
      .map((row) =>
        Object.fromEntries(
          headers.map((header, index) => [header, row[index] ?? '']),
        ),
      );
  }

  /** Serializes an array of flat JSON objects into a quoted CSV table. */
  private objectsToCsv(json: string): string {
    const value: unknown = JSON.parse(json);
    if (
      !Array.isArray(value) ||
      value.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
    ) {
      throw new BadRequestException(
        'JSON-to-CSV requires an array of flat objects',
      );
    }
    const rows = value as Array<Record<string, unknown>>;
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const quote = (cell: unknown) => {
      let value: string;
      if (cell === null || cell === undefined) value = '';
      else if (
        typeof cell === 'string' ||
        typeof cell === 'number' ||
        typeof cell === 'boolean'
      )
        value = String(cell);
      else
        throw new BadRequestException(
          'CSV values must be strings, numbers, booleans, or null',
        );
      return '"' + value.replace(/"/g, '""') + '"';
    };
    return [
      headers.map(quote).join(','),
      ...rows.map((row) =>
        headers.map((header) => quote(row[header])).join(','),
      ),
    ].join('\r\n');
  }

  /** Parses quoted CSV cells, escaped quotes, and embedded line breaks. */
  private parseCsv(csv: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < csv.length; index += 1) {
      const char = csv[index];
      if (quoted && char === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && csv[index + 1] === '\n') index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else cell += char;
    }
    if (quoted)
      throw new BadRequestException(
        'CSV contains an unterminated quoted field',
      );
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }
}
