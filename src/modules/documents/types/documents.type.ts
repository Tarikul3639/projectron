import type { z } from 'zod';
import type {
  documentCreateSchema,
  documentConvertSchema,
  documentInspectSchema,
  documentReadSchema,
  documentTemplateSchema,
  wordCreateSchema,
  spreadsheetCreateSchema,
  presentationCreateSchema,
  pdfCreateSchema,
  officeReadSchema,
  officeInspectSchema,
  officeConvertSchema,
  spreadsheetReadSchema,
} from '../schemas/documents.schemas.js';

// Keeps document service inputs synchronized with the MCP Zod contracts.
export type DocumentReadInput = z.infer<typeof documentReadSchema>;
export type DocumentInspectInput = z.infer<typeof documentInspectSchema>;
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
export type DocumentConvertInput = z.infer<typeof documentConvertSchema>;
export type DocumentTemplateInput = z.infer<typeof documentTemplateSchema>;
export type WordCreateInput = z.infer<typeof wordCreateSchema>;
export type SpreadsheetCreateInput = z.infer<typeof spreadsheetCreateSchema>;
export type PresentationCreateInput = z.infer<typeof presentationCreateSchema>;
export type PdfCreateInput = z.infer<typeof pdfCreateSchema>;
export type OfficeReadInput = z.infer<typeof officeReadSchema>;
export type OfficeInspectInput = z.infer<typeof officeInspectSchema>;
export type OfficeConvertInput = z.infer<typeof officeConvertSchema>;
export type SpreadsheetReadInput = z.infer<typeof spreadsheetReadSchema>;
