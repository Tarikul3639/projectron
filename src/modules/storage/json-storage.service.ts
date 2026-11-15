import { Injectable } from '@nestjs/common';
import { FileStorageService } from './file-storage.service.js';

/**
 *  Provides JSON storage operations on top of the file storage service.
 *  All JSON files are read and written as UTF-8 text with pretty formatting.
 */

/** Provides validated JSON file persistence on top of the shared file-storage abstraction. */
@Injectable()
export class JsonStorageService {
  /** Injects the file-storage abstraction used to persist and retrieve structured JSON data. */
  constructor(private readonly fileStorage: FileStorageService) {}

  /** Reads the selected storage file and parses its contents as the requested JSON data type. */
  async read<T>(path: string): Promise<T> {
    const content = await this.fileStorage.read(path);
    return JSON.parse(content) as T;
  }

  /** Serializes the supplied data as indented JSON and persists it through the root-confined file-storage service. */
  async write<T>(path: string, data: T): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    if (content === undefined) {
      throw new Error('Value cannot be serialized as JSON');
    }
    await this.fileStorage.write(path, content);
  }

  /** Deletes the selected JSON storage file through the shared storage abstraction. */
  async delete(path: string): Promise<void> {
    await this.fileStorage.delete(path);
  }

  /** Checks whether the requested JSON storage file exists without reading or parsing its contents. */
  async exists(path: string): Promise<boolean> {
    return this.fileStorage.exists(path);
  }
}
