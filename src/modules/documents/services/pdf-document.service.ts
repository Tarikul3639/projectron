import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { DocumentFileService } from './document-file.service.js';
import type { PdfCreateInput } from '../types/documents.type.js';
import { countWords } from '../utils/documents.utils.js';

type PdfPageSize = 'A4' | 'Letter';

/** Creates text-first PDFs and extracts text and metadata from existing PDF files. */
@Injectable()
export class PdfDocumentService {
  constructor(private readonly files: DocumentFileService) {}

  /** Creates a searchable PDF from titled sections and paragraphs. */
  async create(input: PdfCreateInput) {
    this.assertPdfPath(input.path);
    const content = input.sections
      .map((section) =>
        [section.heading, ...(section.paragraphs ?? [])]
          .filter(Boolean)
          .join('\n\n'),
      )
      .join('\n\n');
    const buffer = await this.buildTextPdf(
      input.title,
      content,
      input.author ?? 'Projectron',
      input.pageSize,
    );
    const result = await this.files.writeBinary(
      input.path,
      buffer,
      input.overwrite,
      input.rootIndex,
    );
    return {
      ...result,
      format: 'pdf',
      pages: await this.countPdfPages(buffer),
    };
  }

  /** Builds a simple text PDF, used by the explicit Office-to-PDF conversion path. */
  async createFromText(
    path: string,
    title: string,
    content: string,
    author = 'Projectron',
    overwrite = false,
    rootIndex = 0,
  ) {
    this.assertPdfPath(path);
    const buffer = await this.buildTextPdf(title, content, author, 'A4');
    const result = await this.files.writeBinary(
      path,
      buffer,
      overwrite,
      rootIndex,
    );
    return {
      ...result,
      format: 'pdf',
      pages: await this.countPdfPages(buffer),
    };
  }

  /** Extracts text from PDF pages using PDF.js without rendering page images. */
  async read(path: string, rootIndex = 0, maxCharacters = 100_000) {
    this.assertPdfPath(path);
    const { buffer, bytes, modifiedAt } = await this.files.readBinary(
      path,
      rootIndex,
    );
    const loadingTask = getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
    });
    const pdf = await loadingTask.promise;
    try {
      const pages: Array<{ page: number; text: string }> = [];
      const parts: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .filter(Boolean)
          .join(' ');
        pages.push({ page: pageNumber, text });
        parts.push(text);
      }
      const content = parts.join('\n\n');
      return {
        path,
        format: 'pdf',
        bytes,
        modifiedAt,
        pages: pdf.numPages,
        characters: content.length,
        words: countWords(content),
        content: content.slice(0, maxCharacters),
        truncated: content.length > maxCharacters,
      };
    } finally {
      await loadingTask.destroy();
    }
  }

  private async buildTextPdf(
    title: string,
    content: string,
    author: string,
    pageSize: PdfPageSize,
  ): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(title);
    pdf.setAuthor(author);
    pdf.setCreator('Projectron');
    pdf.setProducer('Projectron Documents');
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const dimensions: [number, number] =
      pageSize === 'Letter' ? [612, 792] : [595.28, 841.89];
    const margin = 48;
    const lineHeight = 15;
    let page = pdf.addPage(dimensions);
    let y = dimensions[1] - margin;
    page.drawText(title, {
      x: margin,
      y,
      size: 20,
      font: bold,
      color: rgb(0.09, 0.18, 0.28),
      maxWidth: dimensions[0] - margin * 2,
    });
    y -= 34;
    const maxWidth = dimensions[0] - margin * 2;
    const lines = this.wrapText(content, font, 10.5, maxWidth);
    for (const line of lines) {
      if (y < margin) {
        page = pdf.addPage(dimensions);
        y = dimensions[1] - margin;
      }
      if (line === '') {
        y -= lineHeight;
        continue;
      }
      page.drawText(line, {
        x: margin,
        y,
        size: 10.5,
        font,
        color: rgb(0.16, 0.2, 0.24),
      });
      y -= lineHeight;
    }
    return Buffer.from(await pdf.save());
  }

  private wrapText(
    value: string,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    fontSize: number,
    maxWidth: number,
  ): string[] {
    const result: string[] = [];
    for (const rawLine of value.replace(/\r/g, '').split('\n')) {
      if (!rawLine) {
        result.push('');
        continue;
      }
      let line = '';
      for (const word of rawLine.split(/\s+/)) {
        const candidate = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
          line = candidate;
          continue;
        }
        if (line) result.push(line);
        line = '';
        let segment = '';
        for (const character of word) {
          const next = segment + character;
          if (font.widthOfTextAtSize(next, fontSize) > maxWidth && segment) {
            result.push(segment);
            segment = character;
          } else {
            segment = next;
          }
        }
        line = segment;
      }
      if (line) result.push(line);
    }
    return result;
  }

  private async countPdfPages(buffer: Buffer): Promise<number> {
    const pdf = await PDFDocument.load(buffer);
    return pdf.getPageCount();
  }

  private assertPdfPath(path: string): void {
    if (!path.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('PDF documents must use the .pdf format');
    }
  }
}
