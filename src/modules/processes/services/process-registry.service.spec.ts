import { describe, expect, it } from 'vitest';
import { ProcessRegistryService } from './process-registry.service.js';
describe('ProcessRegistryService', () => {
  const service = new ProcessRegistryService();
  it('starts with an empty registry', () => {
    expect(service.list()).toEqual([]);
    expect(service.size).toBe(0);
  });
  it('rejects unknown process IDs for metadata and logs', () => {
    expect(() => service.get(999999)).toThrow('Managed process not found');
    expect(() => service.getRecord(999999)).toThrow(
      'Managed process not found',
    );
    expect(() => service.getLogs(999999)).toThrow('Managed process not found');
  });
});
