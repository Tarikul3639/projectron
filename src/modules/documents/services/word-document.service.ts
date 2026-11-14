import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import mammoth from 'mammoth';
import { DocumentFileService } from './document-file.service.js';
import type { WordCreateInput } from '../types/documents.type.js';
import { countWords } from '../utils/documents.utils.js';

/** Creates and extracts modern Microsoft Word DOCX documents. */
@Injectable()
export class WordDocumentService {
  constructor(private readonly files: DocumentFileService) {}

  /** Generates a DOCX file with headings, paragraphs, lists, and simple tables. */
  async create(input: WordCreateInput) {
    this.assertDocxPath(input.path);
    const children: Array<Paragraph | Table> = [];
    if (input.title) {
      children.push(
        new Paragraph({
          text: input.title,
          heading: HeadingLevel.TITLE,
          spacing: { after: 360 },
        }),
      );
    }
    for (const section of input.sections) {
      if (section.heading) {
        const heading =
          section.level === 1
            ? HeadingLevel.HEADING_1
            : section.level === 3
              ? HeadingLevel.HEADING_3
              : HeadingLevel.HEADING_2;
        children.push(
          new Paragraph({ text: section.heading, heading, keepNext: true }),
        );
      }
      for (const paragraph of section.paragraphs ?? []) {
        children.push(
          new Paragraph({ text: paragraph, spacing: { after: 160 } }),
        );
      }
      for (const bullet of section.bullets ?? []) {
        children.push(
          new Paragraph({
            text: bullet,
            bullet: { level: 0 },
            spacing: { after: 80 },
          }),
        );
      }
      if (section.table) {
        const rows = [section.table.headers, ...section.table.rows].map(
          (row, index) =>
            new TableRow({
              tableHeader: index === 0,
              children: section.table!.headers.map(
                (_, cellIndex) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: row[cellIndex] ?? '',
                            bold: index === 0,
                          }),
                        ],
                      }),
                    ],
                  }),
              ),
            }),
        );
        children.push(
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        );
        children.push(new Paragraph({ text: '' }));
      }
    }
    const document = new Document({
      creator: input.author ?? 'Projectron',
      title: input.title ?? 'Document',
      subject: input.subject,
      sections: [{ children }],
    });
    const buffer = await Packer.toBuffer(document);
    const result = await this.files.writeBinary(
      input.path,
      buffer,
      input.overwrite,
      input.rootIndex,
    );
    return {
      ...result,
      format: 'docx',
      sections: input.sections.length,
    };
  }

  /** Extracts readable plain text from a DOCX file. */
  async read(path: string, rootIndex = 0, maxCharacters = 100_000) {
    this.assertDocxPath(path);
    const { buffer, bytes, modifiedAt } = await this.files.readBinary(
      path,
      rootIndex,
    );
    const result = await mammoth.extractRawText({ buffer });
    const content = result.value;
    return {
      path,
      format: 'docx',
      bytes,
      modifiedAt,
      content: content.slice(0, maxCharacters),
      truncated: content.length > maxCharacters,
      characters: content.length,
      words: countWords(content),
      warnings: result.messages.map((message) => message.message),
    };
  }

  /** Extracts semantic HTML from DOCX for conversion and downstream rendering. */
  async readHtml(path: string, rootIndex = 0) {
    this.assertDocxPath(path);
    const { buffer } = await this.files.readBinary(path, rootIndex);
    const result = await mammoth.convertToHtml({ buffer });
    return {
      html: result.value,
      warnings: result.messages.map((message) => message.message),
    };
  }

  private assertDocxPath(path: string): void {
    if (!path.toLowerCase().endsWith('.docx')) {
      throw new BadRequestException('Word documents must use the .docx format');
    }
  }
}
