import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocumentFileService } from './document-file.service.js';
import { WordDocumentService } from './word-document.service.js';
import { SpreadsheetDocumentService } from './spreadsheet-document.service.js';
import { PresentationDocumentService } from './presentation-document.service.js';
import { PdfDocumentService } from './pdf-document.service.js';
import { DocumentConverterService } from './document-converter.service.js';
import { OfficeConverterService } from './office-converter.service.js';

describe('Office document services', () => {
  let root: string;
  let files: DocumentFileService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-office-'));
    files = new DocumentFileService({
      filesystemAllowedRoots: root,
    } as never);
    await files.onModuleInit();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('creates and reads a Word DOCX document', async () => {
    const service = new WordDocumentService(files);
    const created = await service.create({
      path: 'report.docx',
      title: 'Project Report',
      sections: [
        {
          heading: 'Summary',
          paragraphs: ['The report content is readable.'],
          bullets: ['First item'],
          table: { headers: ['Name', 'Value'], rows: [['Status', 'Ready']] },
        },
      ],
      overwrite: false,
      clientId: 'test-client',
    });
    const read = await service.read('report.docx');
    expect(created.format).toBe('docx');
    expect(read.content).toContain('The report content is readable.');
    expect(read.content).toContain('First item');
  });

  it('creates and reads an Excel workbook with multiple worksheets', async () => {
    const service = new SpreadsheetDocumentService(files);
    const created = await service.create({
      path: 'metrics.xlsx',
      title: 'Metrics',
      sheets: [
        {
          name: 'Revenue',
          headers: ['Month', 'Amount'],
          rows: [
            ['January', 120],
            ['February', 150],
          ],
          freezeHeader: true,
          autoFilter: true,
        },
        {
          name: 'Costs',
          headers: ['Category', 'Amount'],
          rows: [['Hosting', 30]],
          freezeHeader: true,
          autoFilter: false,
        },
      ],
      overwrite: false,
      clientId: 'test-client',
    });
    const read = await service.read('metrics.xlsx');
    expect(created.sheetNames).toEqual(['Revenue', 'Costs']);
    expect(read.sheetCount).toBe(2);
    expect(read.sheets[0].rows[0]).toEqual(['January', '120']);
    await expect(service.toCsv('metrics.xlsx')).resolves.toContain(
      '"January","120"',
    );
  });

  it('creates and extracts slide text from a PowerPoint presentation', async () => {
    const service = new PresentationDocumentService(files);
    const created = await service.create({
      path: 'deck.pptx',
      title: 'Product Update',
      slides: [
        {
          title: 'Highlights',
          body: 'A short summary',
          bullets: ['Feature one', 'Feature two'],
          notes: 'Presenter notes',
        },
        { title: 'Next Steps', bullets: ['Ship', 'Measure'] },
      ],
      overwrite: false,
      clientId: 'test-client',
    });
    const read = await service.read('deck.pptx');
    expect(created.slides).toBe(2);
    expect(read.slideCount).toBe(2);
    expect(read.content).toContain('Feature one');
    expect(read.content).toContain('Next Steps');
  });

  it('creates and extracts selectable text from a PDF', async () => {
    const service = new PdfDocumentService(files);
    const created = await service.create({
      path: 'brief.pdf',
      title: 'Quarterly Brief',
      pageSize: 'A4',
      sections: [
        {
          heading: 'Summary',
          paragraphs: [
            'This PDF contains searchable text.',
            'Second paragraph.',
          ],
        },
      ],
      overwrite: false,
      clientId: 'test-client',
    });
    const read = await service.read('brief.pdf');
    expect(created.format).toBe('pdf');
    expect(read.pages).toBeGreaterThan(0);
    expect(read.content).toContain('searchable text');
  });

  it('converts XLSX to CSV and DOCX to text-first PDF', async () => {
    const word = new WordDocumentService(files);
    const spreadsheet = new SpreadsheetDocumentService(files);
    const presentation = new PresentationDocumentService(files);
    const pdf = new PdfDocumentService(files);
    const converter = new OfficeConverterService(
      files,
      new DocumentConverterService(files),
      word,
      spreadsheet,
      presentation,
      pdf,
    );
    await spreadsheet.create({
      path: 'source.xlsx',
      sheets: [
        {
          name: 'Data',
          headers: ['Name', 'Value'],
          rows: [['Alpha', 10]],
        },
      ],
      overwrite: false,
      clientId: 'test-client',
    });
    await word.create({
      path: 'source.docx',
      title: 'Source Report',
      sections: [{ paragraphs: ['Conversion preserves readable text.'] }],
      overwrite: false,
      clientId: 'test-client',
    });
    await converter.convert({
      sourcePath: 'source.xlsx',
      destinationPath: 'export.csv',
      overwrite: false,
      clientId: 'test-client',
    });
    await converter.convert({
      sourcePath: 'source.docx',
      destinationPath: 'export.pdf',
      overwrite: false,
      clientId: 'test-client',
    });
    const csv = await files.read({ path: 'export.csv' });
    const pdfText = await pdf.read('export.pdf');
    expect(csv.content).toContain('Alpha');
    expect(pdfText.content).toContain('Conversion preserves readable text.');
  });
});
