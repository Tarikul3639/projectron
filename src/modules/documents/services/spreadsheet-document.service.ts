import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DocumentFileService } from './document-file.service.js';
import type { SpreadsheetCreateInput } from '../types/documents.type.js';

/** Generates and reads XLSX workbooks, worksheets, values, and basic formatting. */
@Injectable()
export class SpreadsheetDocumentService {
  constructor(private readonly files: DocumentFileService) {}

  /** Creates an XLSX workbook with multiple sheets, headers, filters, and frozen header rows. */
  async create(input: SpreadsheetCreateInput) {
    this.assertXlsxPath(input.path);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = input.author ?? 'Projectron';
    workbook.title = input.title ?? 'Workbook';
    workbook.created = new Date();
    for (const definition of input.sheets) {
      const sheet = workbook.addWorksheet(definition.name);
      const header = sheet.addRow(definition.headers);
      header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      header.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF24476B' },
      };
      definition.headers.forEach((value, index) => {
        sheet.getColumn(index + 1).width = Math.min(
          Math.max(value.length + 3, 12),
          42,
        );
      });
      sheet.addRows(definition.rows);
      if (definition.freezeHeader) {
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
      }
      if (definition.autoFilter) {
        const lastColumn = this.columnName(definition.headers.length);
        const lastRow = Math.max(1, definition.rows.length + 1);
        sheet.autoFilter = 'A1:' + lastColumn + lastRow;
      }
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', wrapText: true };
        });
      });
    }
    const output = await workbook.xlsx.writeBuffer();
    const result = await this.files.writeBinary(
      input.path,
      Buffer.from(output),
      input.overwrite,
      input.rootIndex,
    );
    return {
      ...result,
      format: 'xlsx',
      sheets: input.sheets.length,
      sheetNames: input.sheets.map((sheet) => sheet.name),
    };
  }

  /** Reads worksheet names, headers, values, dimensions, and workbook metadata. */
  async read(path: string, rootIndex = 0, maxRows = 2000) {
    this.assertXlsxPath(path);
    const { buffer, bytes, modifiedAt } = await this.files.readBinary(
      path,
      rootIndex,
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    const sheets = workbook.worksheets.map((worksheet) => {
      const rows: string[][] = [];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > maxRows + 1) return;
        rows.push(
          Array.from(
            { length: worksheet.columnCount },
            (_, index) => row.getCell(index + 1).text,
          ),
        );
      });
      return {
        name: worksheet.name,
        rowCount: Math.max(worksheet.rowCount - 1, 0),
        columnCount: worksheet.columnCount,
        headers: rows[0] ?? [],
        rows: rows.slice(1),
        truncated: worksheet.rowCount > maxRows + 1,
      };
    });
    return {
      path,
      format: 'xlsx',
      bytes,
      modifiedAt,
      creator: workbook.creator,
      title: workbook.title,
      sheetCount: workbook.worksheets.length,
      sheets,
    };
  }

  /** Exports the first worksheet as standards-compliant quoted CSV. */
  async toCsv(path: string, rootIndex = 0): Promise<string> {
    const workbook = await this.read(path, rootIndex, 10000);
    const first = workbook.sheets[0];
    if (!first) return '';
    const rows = [first.headers, ...first.rows];
    return rows
      .map((row) =>
        row.map((value) => '"' + value.replace(/"/g, '""') + '"').join(','),
      )
      .join('\r\n');
  }

  /** Exports worksheet rows as a JSON array of objects using headers as keys. */
  async toJson(path: string, rootIndex = 0) {
    const workbook = await this.read(path, rootIndex, 10000);
    const first = workbook.sheets[0];
    if (!first) return [];
    return first.rows.map((row) =>
      Object.fromEntries(
        first.headers.map((header, index) => [header, row[index] ?? '']),
      ),
    );
  }

  private assertXlsxPath(path: string): void {
    if (!path.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException(
        'Excel workbooks must use the .xlsx format',
      );
    }
  }

  private columnName(value: number): string {
    let current = value;
    let result = '';
    while (current > 0) {
      const remainder = (current - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      current = Math.floor((current - 1) / 26);
    }
    return result;
  }
}
