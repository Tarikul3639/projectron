import { describe, expect, it } from 'vitest';
import { DocumentTemplateService } from './document-template.service.js';

describe('DocumentTemplateService', () => {
  const service = new DocumentTemplateService();

  it('generates a README template for a project', () => {
    expect(
      service.generate({
        template: 'readme',
        title: 'Projectron',
        path: 'README.md',
        clientId: 'test-client',
      }),
    ).toContain('# Projectron');
  });

  it('generates an architecture template', () => {
    expect(
      service.generate({
        template: 'architecture',
        title: 'Projectron',
        path: 'ARCHITECTURE.md',
        clientId: 'test-client',
      }),
    ).toContain('## Data Flow');
  });
});
