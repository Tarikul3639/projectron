import { BadRequestException, Injectable } from '@nestjs/common';
import JSZip from 'jszip';
type SlideLike = {
  background: { color: string };
  addText(
    text: string | Array<{ text: string; options: Record<string, unknown> }>,
    options: Record<string, unknown>,
  ): unknown;
  addNotes(notes: string): unknown;
};
type PresentationLike = {
  layout: string;
  author: string;
  subject: string;
  title: string;
  company: string;
  lang: string;
  addSlide(): SlideLike;
  write(options: { outputType: 'nodebuffer' }): Promise<Uint8Array>;
};
import { DocumentFileService } from './document-file.service.js';
import type { PresentationCreateInput } from '../types/documents.type.js';

/** Generates and extracts text from modern PowerPoint PPTX presentations. */
@Injectable()
export class PresentationDocumentService {
  constructor(private readonly files: DocumentFileService) {}

  /** Creates a widescreen presentation with title, body text, bullets, and speaker notes. */
  async create(input: PresentationCreateInput) {
    this.assertPptxPath(input.path);
    const PptxConstructor = (await import('pptxgenjs'))
      .default as unknown as new () => PresentationLike;
    const pptx = new PptxConstructor();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = input.author ?? 'Projectron';
    pptx.subject = input.subject ?? '';
    pptx.title = input.title;
    pptx.company = 'Projectron';
    pptx.lang = 'en-US';
    for (let index = 0; index < input.slides.length; index += 1) {
      const definition = input.slides[index];
      const slide = pptx.addSlide();
      slide.background = { color: 'FFFFFF' };
      slide.addText(definition.title, {
        x: 0.65,
        y: 0.42,
        w: 12.0,
        h: 0.75,
        fontFace: 'Aptos Display',
        fontSize: 28,
        bold: true,
        color: '17324D',
        margin: 0,
        breakLine: false,
      });
      if (definition.body) {
        slide.addText(definition.body, {
          x: 0.75,
          y: 1.55,
          w: 11.8,
          h: 2.1,
          fontFace: 'Aptos',
          fontSize: 19,
          color: '273746',
          breakLine: false,
          valign: 'top',
          margin: 0.04,
          fit: 'shrink',
        });
      }
      if (definition.bullets?.length) {
        const startY = definition.body ? 3.75 : 1.65;
        const bulletRuns = definition.bullets.map((text) => ({
          text,
          options: {
            bullet: { indent: 18 },
            hanging: 4,
            breakLine: true,
          },
        }));
        slide.addText(bulletRuns, {
          x: 0.9,
          y: startY,
          w: 11.4,
          h: 4.1,
          fontFace: 'Aptos',
          fontSize: 19,
          color: '273746',
          paraSpaceAfterPt: 14,
          valign: 'top',
          margin: 0.04,
          fit: 'shrink',
        });
      }
      slide.addText(String(index + 1), {
        x: 12.25,
        y: 7.05,
        w: 0.35,
        h: 0.2,
        fontSize: 9,
        color: '758494',
        align: 'right',
        margin: 0,
      });
      if (definition.notes) slide.addNotes(definition.notes);
    }
    const output = await pptx.write({ outputType: 'nodebuffer' });
    const result = await this.files.writeBinary(
      input.path,
      Buffer.from(output),
      input.overwrite,
      input.rootIndex,
    );
    return {
      ...result,
      format: 'pptx',
      slides: input.slides.length,
      title: input.title,
    };
  }

  /** Extracts visible slide text for summaries and downstream conversion. */
  async read(path: string, rootIndex = 0, maxCharacters = 100_000) {
    this.assertPptxPath(path);
    const { buffer, bytes, modifiedAt } = await this.files.readBinary(
      path,
      rootIndex,
    );
    const archive = await JSZip.loadAsync(buffer);
    const slidePaths = Object.keys(archive.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort(
        (left, right) =>
          Number(left.match(/slide(\d+)\.xml$/)?.[1] ?? 0) -
          Number(right.match(/slide(\d+)\.xml$/)?.[1] ?? 0),
      );
    const slides: Array<{ number: number; text: string }> = [];
    for (let index = 0; index < slidePaths.length; index += 1) {
      const entry = archive.file(slidePaths[index]);
      if (!entry) continue;
      const xml = await entry.async('text');
      const matches = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)];
      const text = matches
        .map((match) => this.decodeXml(match[1]))
        .join('\n')
        .trim();
      slides.push({ number: index + 1, text });
    }
    const content = slides
      .map((slide) => 'Slide ' + slide.number + '\n' + slide.text)
      .join('\n\n');
    return {
      path,
      format: 'pptx',
      bytes,
      modifiedAt,
      slideCount: slides.length,
      slides,
      content: content.slice(0, maxCharacters),
      truncated: content.length > maxCharacters,
    };
  }

  private decodeXml(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  private assertPptxPath(path: string): void {
    if (!path.toLowerCase().endsWith('.pptx')) {
      throw new BadRequestException(
        'PowerPoint presentations must use the .pptx format',
      );
    }
  }
}
