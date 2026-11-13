import type { z } from 'zod';
import type {
  documentCreateSchema,
  documentConvertSchema,
  documentInspectSchema,
  documentReadSchema,
  documentTemplateSchema,
} from './documents.schemas.js';

// Keeps document service inputs synchronized with the MCP Zod contracts.
export type DocumentReadInput = z.infer<typeof documentReadSchema>;
export type DocumentInspectInput = z.infer<typeof documentInspectSchema>;
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
export type DocumentConvertInput = z.infer<typeof documentConvertSchema>;
export type DocumentTemplateInput = z.infer<typeof documentTemplateSchema>;
