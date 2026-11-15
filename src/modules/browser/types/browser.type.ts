import type { z } from 'zod';
import type {
  browserLaunchSchema,
  browserNavigateSchema,
  browserScreenshotSchema,
} from '../schemas/browser.schemas.js';

export type BrowserLaunchInput = z.infer<typeof browserLaunchSchema>;
export type BrowserNavigateInput = z.infer<typeof browserNavigateSchema>;
export type BrowserScreenshotInput = z.infer<typeof browserScreenshotSchema>;
