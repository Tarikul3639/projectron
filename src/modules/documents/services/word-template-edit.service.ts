import { BadRequestException, Injectable } from '@nestjs/common';
import JSZip from 'jszip';
import type { WordTemplateEditInput } from '../types/documents.type.js';
import { DocumentFileService } from './document-file.service.js';

interface TextNode {
  xmlStart: number;
  xmlEnd: number;
  openingTag: string;
  text: string;
}

export interface ReplacementResult {
  find: string;
  occurrences: number;
}

const WORD_TEXT_PARTS = /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/;

/** Edits existing DOCX OOXML into a new output archive while preserving template structure and styles. */
@Injectable()
export class WordTemplateEditService {
  constructor(private readonly files: DocumentFileService) {}

  /** Applies exact text/placeholder replacements to a DOCX template and writes a new DOCX file. */
  async edit(input: WordTemplateEditInput) {
    this.assertDocxPath(input.sourcePath);
    this.assertDocxPath(input.destinationPath);

    if (this.normalizePath(input.sourcePath) === this.normalizePath(input.destinationPath)) {
      throw new BadRequestException(
        'Template sourcePath and destinationPath must be different; the original template is never edited in place',
      );
    }

    const { buffer: sourceBuffer } = await this.files.readBinary(
      input.sourcePath,
      input.rootIndex,
    );
    const zip = await JSZip.loadAsync(sourceBuffer);

    const replacements = input.replacements.map((replacement) => ({
      find: replacement.find,
      replaceWith: replacement.replaceWith,
      occurrences: 0,
    }));

    const partNames = Object.keys(zip.files).filter((name) =>
      WORD_TEXT_PARTS.test(name),
    );
    if (partNames.length === 0) {
      throw new BadRequestException(
        'The DOCX template does not contain an editable Word document part',
      );
    }

    for (const partName of partNames) {
      const entry = zip.file(partName);
      if (!entry) continue;
      const xml = await entry.async('string');
      const updated = this.replaceInXmlPart(xml, replacements);
      if (updated.changed) {
        zip.file(partName, updated.xml);
      }
    }

    const results: ReplacementResult[] = replacements.map((replacement) => ({
      find: replacement.find,
      occurrences: replacement.occurrences,
    }));

    const missing = results.filter((result) => result.occurrences === 0);
    if (input.requireAll && missing.length > 0) {
      throw new BadRequestException(
        'One or more requested replacements were not found in the DOCX template: ' +
          missing.map((result) => result.find).join(', '),
      );
    }

    if (results.every((result) => result.occurrences === 0)) {
      throw new BadRequestException(
        'No requested replacement matched the DOCX template; no output was written',
      );
    }

    const output = await zip.generateAsync({ type: 'nodebuffer' });
    const writeResult = await this.files.writeBinary(
      input.destinationPath,
      output,
      input.overwrite,
      input.rootIndex,
    );

    return {
      ...writeResult,
      format: 'docx',
      sourcePath: input.sourcePath,
      destinationPath: input.destinationPath,
      partsScanned: partNames.length,
      replacements: results,
      missingReplacements: missing.map((result) => result.find),
      templatePreserved: true,
    };
  }

  private replaceInXmlPart(
    xml: string,
    replacements: Array<{
      find: string;
      replaceWith: string;
      occurrences: number;
    }>,
  ): { xml: string; changed: boolean } {
    let changed = false;
    const paragraphPattern = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;

    const updated = xml.replace(paragraphPattern, (paragraph) => {
      const textPattern = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g;
      const nodes: TextNode[] = [];

      for (const match of paragraph.matchAll(textPattern)) {
        const index = match.index ?? 0;
        nodes.push({
          xmlStart: index,
          xmlEnd: index + match[0].length,
          openingTag: '<w:t' + match[1] + '>',
          text: this.decodeXml(match[2]),
        });
      }

      if (nodes.length === 0) return paragraph;

      let paragraphChanged = false;

      for (const replacement of replacements) {
        let cursor = 0;

        while (true) {
          const logicalText = nodes.map((node) => node.text).join('');
          const matchIndex = logicalText.indexOf(replacement.find, cursor);
          if (matchIndex < 0) break;

          this.applyReplacement(
            nodes,
            matchIndex,
            replacement.find.length,
            replacement.replaceWith,
          );
          replacement.occurrences += 1;
          paragraphChanged = true;
          changed = true;
          cursor = matchIndex + replacement.replaceWith.length;
        }
      }

      if (!paragraphChanged) return paragraph;

      let rebuilt = paragraph;
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        rebuilt =
          rebuilt.slice(0, node.xmlStart) +
          this.renderTextNode(node) +
          rebuilt.slice(node.xmlEnd);
      }
      return rebuilt;
    });

    return { xml: updated, changed };
  }

  private applyReplacement(
    nodes: TextNode[],
    start: number,
    length: number,
    replacement: string,
  ): void {
    const end = start + length;
    let offset = 0;
    let startNode = -1;
    let endNode = -1;
    let startOffset = 0;
    let endOffset = 0;

    for (let index = 0; index < nodes.length; index += 1) {
      const nodeStart = offset;
      const nodeEnd = offset + nodes[index].text.length;

      if (startNode === -1 && start >= nodeStart && start < nodeEnd) {
        startNode = index;
        startOffset = start - nodeStart;
      }

      if (endNode === -1 && end >= nodeStart && end <= nodeEnd) {
        endNode = index;
        endOffset = end - nodeStart;
        break;
      }

      offset = nodeEnd;
    }

    if (startNode < 0 || endNode < 0) return;

    if (startNode === endNode) {
      const text = nodes[startNode].text;
      nodes[startNode].text =
        text.slice(0, startOffset) +
        replacement +
        text.slice(endOffset);
      return;
    }

    const startText = nodes[startNode].text;
    const endText = nodes[endNode].text;

    nodes[startNode].text =
      startText.slice(0, startOffset) + replacement;
    nodes[endNode].text = endText.slice(endOffset);

    for (let index = startNode + 1; index < endNode; index += 1) {
      nodes[index].text = '';
    }
  }

  private renderTextNode(node: TextNode): string {
    let openingTag = node.openingTag;
    if (/^\s|\s$/.test(node.text) && !/xml:space\s*=/.test(openingTag)) {
      openingTag = openingTag.replace(
        />$/,
        ' xml:space="preserve">',
      );
    }
    return openingTag + this.encodeXml(node.text) + '</w:t>';
  }

  private decodeXml(value: string): string {
    return value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  private encodeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private assertDocxPath(path: string): void {
    if (!path.toLowerCase().endsWith('.docx')) {
      throw new BadRequestException(
        'Word template paths must use the .docx format',
      );
    }
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\.\//, '');
  }
}