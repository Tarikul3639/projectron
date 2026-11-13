import * as z from 'zod';

const pageId = z.string().uuid().optional();
const sessionId = z.string().uuid().optional();
const clientId = z.string().trim().min(1).max(128);
const approvalRequestId = z.string().uuid().optional();
const selector = z.string().trim().min(1).max(2000);
const url = z
  .string()
  .url()
  .max(8192)
  .refine(
    (value) => /^https?:/i.test(value),
    'Only HTTP and HTTPS URLs are supported',
  );

// Validates browser startup and isolated context creation.
export const browserLaunchSchema = z
  .object({
    headless: z.boolean().optional(),
    slowMo: z.number().int().min(0).max(2000).optional(),
    timeoutMs: z.number().int().min(100).max(120000).optional(),
  })
  .strict();
export const browserSessionSchema = z.object({ sessionId }).strict();
export const browserPageSchema = z.object({ pageId }).strict();
export const browserNewPageSchema = z.object({ sessionId }).strict();
export const browserNavigateSchema = z
  .object({
    url,
    pageId,
    waitUntil: z
      .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
      .optional(),
    timeoutMs: z.number().int().min(100).max(120000).optional(),
  })
  .strict();
export const browserWaitSchema = z
  .object({
    pageId,
    selector,
    state: z.enum(['attached', 'detached', 'visible', 'hidden']).optional(),
    timeoutMs: z.number().int().min(100).max(120000).optional(),
  })
  .strict();
export const browserSelectorSchema = z.object({ pageId, selector }).strict();
export const browserTextSchema = z
  .object({
    pageId,
    selector: z.string().trim().min(1).max(2000).optional(),
    maxCharacters: z.number().int().min(1).max(100000).optional(),
  })
  .strict();
export const browserLinksSchema = z
  .object({ pageId, limit: z.number().int().min(1).max(500).optional() })
  .strict();
export const browserScreenshotSchema = z
  .object({
    pageId,
    fullPage: z.boolean().optional(),
    selector: z.string().trim().min(1).max(2000).optional(),
    path: z.string().trim().min(1).max(4096).optional(),
    type: z.enum(['png', 'jpeg']).optional(),
    quality: z.number().int().min(1).max(100).optional(),
  })
  .strict();
export const browserFillSchema = z
  .object({ pageId, selector, value: z.string().max(100000) })
  .strict();
export const browserPressSchema = z
  .object({
    pageId,
    selector: z.string().trim().min(1).max(2000).optional(),
    key: z.string().trim().min(1).max(100),
  })
  .strict();
export const browserScrollSchema = z
  .object({
    pageId,
    deltaX: z.number().min(-100000).max(100000).optional(),
    deltaY: z.number().min(-100000).max(100000).optional(),
  })
  .strict();
export const browserSelectSchema = z
  .object({
    pageId,
    selector,
    values: z.array(z.string().max(1000)).min(1).max(100),
  })
  .strict();
export const browserUploadSchema = z
  .object({
    pageId,
    selector,
    filePaths: z.array(z.string().trim().min(1).max(4096)).min(1).max(20),
    clientId,
    approvalRequestId,
  })
  .strict();
export const browserDownloadSchema = z
  .object({
    pageId,
    selector,
    saveTo: z.string().trim().min(1).max(4096).optional(),
    clientId,
    approvalRequestId,
  })
  .strict();
export const browserDownloadIdSchema = z
  .object({ downloadId: z.string().uuid() })
  .strict();
export const browserEvalSchema = z
  .object({
    pageId,
    expression: z.string().min(1).max(20000),
    clientId,
    approvalRequestId,
  })
  .strict();
export const browserPdfSchema = z
  .object({
    pageId,
    path: z.string().trim().min(1).max(4096),
    clientId,
    approvalRequestId,
  })
  .strict();
export const browserStorageReadSchema = z
  .object({ pageId, storage: z.enum(['local', 'session']) })
  .strict();
export const browserStorageWriteSchema = z
  .object({
    pageId,
    storage: z.enum(['local', 'session']),
    key: z.string().min(1).max(2000),
    value: z.string().max(100000),
    clientId,
    approvalRequestId,
  })
  .strict();
export const browserCookieReadSchema = z.object({ pageId }).strict();
export const browserCookieSetSchema = z
  .object({
    pageId,
    cookies: z
      .array(
        z
          .object({
            name: z.string().min(1),
            value: z.string(),
            url: z.string().url().optional(),
            domain: z.string().optional(),
            path: z.string().optional(),
            expires: z.number().optional(),
            httpOnly: z.boolean().optional(),
            secure: z.boolean().optional(),
            sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    clientId,
    approvalRequestId,
  })
  .strict();
export const browserViewportSchema = z
  .object({
    pageId,
    width: z.number().int().min(320).max(7680),
    height: z.number().int().min(240).max(4320),
    deviceScaleFactor: z.number().min(0.5).max(3).optional(),
  })
  .strict();
export const browserDeviceSchema = z
  .object({ pageId, device: z.enum(['desktop', 'mobile', 'tablet']) })
  .strict();
export const browserDialogSchema = z
  .object({
    pageId,
    action: z.enum(['accept', 'dismiss']),
    promptText: z.string().max(10000).optional(),
  })
  .strict();
export const browserTraceSchema = z
  .object({ pageId, path: z.string().trim().min(1).max(4096).optional() })
  .strict();
export const browserWaitUrlSchema = z
  .object({
    pageId,
    url: z.string().min(1).max(8192),
    timeoutMs: z.number().int().min(100).max(120000).optional(),
  })
  .strict();
export const browserGoSchema = z.object({ pageId }).strict();
export const browserNewContextSchema = z.object({}).strict();
export const browserPageInfoSchema = z.object({ pageId }).strict();
export const browserNetworkSchema = z
  .object({ pageId, limit: z.number().int().min(1).max(500).optional() })
  .strict();
export const browserPrintSchema = browserPdfSchema;
export const browserEmptySchema = z.object({}).strict();

export type BrowserLaunchInput = z.infer<typeof browserLaunchSchema>;
export type BrowserNavigateInput = z.infer<typeof browserNavigateSchema>;
export type BrowserScreenshotInput = z.infer<typeof browserScreenshotSchema>;
