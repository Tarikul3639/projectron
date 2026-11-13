import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStorageService } from './file-storage.service.js';
import { JsonStorageService } from './json-storage.service.js';

describe('JsonStorageService', () => {
  let root: string;
  let service: JsonStorageService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-json-'));
    const fileStorage = new FileStorageService({ storagePath: root } as never);
    service = new JsonStorageService(fileStorage);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes and reads JSON data', async () => {
    const value = { name: 'Projectron', enabled: true };
    await service.write('settings/app.json', value);
    expect(await service.read<typeof value>('settings/app.json')).toEqual(
      value,
    );
  });

  it('checks and deletes JSON files', async () => {
    await service.write('data.json', { count: 1 });
    expect(await service.exists('data.json')).toBe(true);
    await service.delete('data.json');
    expect(await service.exists('data.json')).toBe(false);
  });

  it('throws when the stored JSON is invalid', async () => {
    const fileStorage = new FileStorageService({ storagePath: root } as never);
    await fileStorage.write('broken.json', '{invalid');
    await expect(service.read('broken.json')).rejects.toThrow();
  });
});
