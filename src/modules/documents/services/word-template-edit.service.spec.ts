import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocumentFileService } from './document-file.service.js';
import { CoordinationService } from '../../../core/coordination/services/coordination.service.js';
import { WordTemplateEditService } from './word-template-edit.service.js';

describe('WordTemplateEditService', () => {
  let root: string;
  let files: DocumentFileService;
  let service: WordTemplateEditService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-word-template-'));
    files = new DocumentFileService(
      {
        filesystemAllowedRoots: root,
      } as never,
      new CoordinationService(),
    );
    await files.onModuleInit();
    service = new WordTemplateEditService(files);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('creates a new DOCX from a template while preserving the template package styles', async () => {
    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun('{{Company}}'),
                new TextRun({ text: ' — Backend Developer', bold: true }),
              ],
            }),
          ],
        },
      ],
    });
    const templateBuffer = await Packer.toBuffer(document);
    await files.writeBinary('template.docx', templateBuffer);

    const result = await service.edit({
      sourcePath: 'template.docx',
      destinationPath: 'tailored.docx',
      replacements: [
        { find: '{{Company}}', replaceWith: 'Acme Corporation' },
      ],
      requireAll: true,
      overwrite: false,
      clientId: 'test-client',
    });

    expect(result.templatePreserved).toBe(true);
    expect(result.replacements[0]).toEqual({
      find: '{{Company}}',
      occurrences: 1,
    });

    const original = await JSZip.loadAsync(await readFile(join(root, 'template.docx')));
    const tailored = await JSZip.loadAsync(await readFile(join(root, 'tailored.docx')));

    expect(tailored.file('word/styles.xml')).not.toBeNull();
    expect(await original.file('word/styles.xml')!.async('string')).toBe(
      await tailored.file('word/styles.xml')!.async('string'),
    );

    const documentXml = await tailored.file('word/document.xml')!.async('string');
    expect(documentXml).toContain('Acme Corporation');
    expect(documentXml).not.toContain('{{Company}}');

    expect((await readFile(join(root, 'template.docx'))).equals(templateBuffer)).toBe(true);
  });

  it('replaces placeholders that are split across multiple Word text runs', async () => {
    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun('{{Com'),
                new TextRun({ text: 'pany}}', italic: true }),
              ],
            }),
          ],
        },
      ],
    });
    await files.writeBinary('split-template.docx', await Packer.toBuffer(document));

    await service.edit({
      sourcePath: 'split-template.docx',
      destinationPath: 'split-tailored.docx',
      replacements: [{ find: '{{Company}}', replaceWith: 'Acme' }],
      requireAll: true,
      overwrite: false,
      clientId: 'test-client',
    });

    const tailored = await JSZip.loadAsync(
      await readFile(join(root, 'split-tailored.docx')),
    );
    const documentXml = await tailored.file('word/document.xml')!.async('string');
    expect(documentXml).toContain('Acme');
    expect(documentXml).not.toContain('{{Company}}');
  });

  it('fails when a required replacement is missing without writing output', async () => {
    const document = new Document({
      sections: [{ children: [new Paragraph('No placeholder here')] }],
    });
    await files.writeBinary('missing-template.docx', await Packer.toBuffer(document));

    await expect(
      service.edit({
        sourcePath: 'missing-template.docx',
        destinationPath: 'missing-output.docx',
        replacements: [{ find: '{{Company}}', replaceWith: 'Acme' }],
        requireAll: true,
        overwrite: false,
        clientId: 'test-client',
      }),
    ).rejects.toThrow('not found');

    await expect(
      readFile(join(root, 'missing-output.docx')),
    ).rejects.toThrow();
  });

  it('rejects editing the template in place', async () => {
    const document = new Document({
      sections: [{ children: [new Paragraph('{{Company}}')] }],
    });
    await files.writeBinary('same.docx', await Packer.toBuffer(document));

    await expect(
      service.edit({
        sourcePath: 'same.docx',
        destinationPath: 'same.docx',
        replacements: [{ find: '{{Company}}', replaceWith: 'Acme' }],
        requireAll: true,
        overwrite: false,
        clientId: 'test-client',
      }),
    ).rejects.toThrow('must be different');
  });
});