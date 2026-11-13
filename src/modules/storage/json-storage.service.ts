import { Injectable } from '@nestjs/common';
import { FileStorageService } from './file-storage.service.js';

/**
 *  Provides JSON storage operations on top of the file storage service.
 *  All JSON files are read and written as UTF-8 text with pretty formatting.
 */

@Injectable()
export class JsonStorageService {
  constructor(private readonly fileStorage: FileStorageService) {}

  /** Reads and parses a JSON file from the storage directory. */
  async read<T>(path: string): Promise<T> {
    const content = await this.fileStorage.read(path);
    return JSON.parse(content) as T;
  }

  /** Serializes data as formatted JSON and saves it in the storage directory. */
  async write<T>(path: string, data: T): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    if (content === undefined) {
      throw new Error('Value cannot be serialized as JSON');
    }
    await this.fileStorage.write(path, content);
  }

  /** Removes a JSON file from the storage directory. */
  async delete(path: string): Promise<void> {
    await this.fileStorage.delete(path);
  }

  /** Checks whether a JSON file exists in the storage directory. */
  async exists(path: string): Promise<boolean> {
    return this.fileStorage.exists(path);
  }
}
