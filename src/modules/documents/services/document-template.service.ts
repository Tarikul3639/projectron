import { Injectable } from '@nestjs/common';
import type { DocumentTemplateInput } from '../types/documents.type.js';

/** Produces structured starter content for common software-project documents. */
@Injectable()
export class DocumentTemplateService {
  /** Returns a complete Markdown template with the supplied project title. */
  generate(input: DocumentTemplateInput): string {
    const project = input.projectName ?? input.title;
    const templates: Record<DocumentTemplateInput['template'], string> = {
      readme:
        '# ' +
        input.title +
        '\n\n## Overview\nDescribe what ' +
        project +
        ' does and who it is for.\n\n## Features\n- \n\n## Requirements\n- \n\n## Installation\n\n## Usage\n\n## Configuration\nDocument supported configuration options. Never include secret values.\n\n## Development\n\n## License\n',
      api:
        '# ' +
        input.title +
        ' — API Documentation\n\n## Overview\n\n## Authentication\nDescribe the authentication mechanism. Do not document real credentials.\n\n## Conventions\n\n## Endpoints\n### METHOD /path\n\n**Description:**\n\n**Parameters:**\n\n**Request:**\n\n**Response:**\n\n**Errors:**\n',
      architecture:
        '# ' +
        input.title +
        ' — Architecture\n\n## Goals and Constraints\n## System Context\n## High-Level Design\n## Modules and Responsibilities\n## Data Flow\n## External Integrations\n## Security and Trust Boundaries\n## Failure Handling\n## Observability\n## Deployment\n## Decisions and Trade-offs\n',
      'user-guide':
        '# ' +
        input.title +
        ' — User Guide\n\n## Introduction\n## Before You Begin\n## Getting Started\n## Core Workflows\n## Configuration\n## Troubleshooting\n## Frequently Asked Questions\n## Support\n',
      changelog:
        '# Changelog — ' +
        input.title +
        '\n\nAll notable changes are documented here.\n\n## [Unreleased]\n### Added\n### Changed\n### Fixed\n### Removed\n',
    };
    return templates[input.template];
  }
}
