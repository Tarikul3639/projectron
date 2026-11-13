import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from './app.config.js';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) { }

  /**
   * Returns a validated environment value with its inferred TypeScript type.
   * Throws an error if the requested configuration key is missing.
   */
  private getValue<K extends keyof Environment>(key: K): Environment[K] {
    return this.configService.getOrThrow<Environment[K]>(key);
  }

  /** Current application environment: development, production, or test. */
  get nodeEnv(): Environment['NODE_ENV'] {
    return this.getValue('NODE_ENV');
  }

  /** Network interface address the application listens on. */
  get host(): string {
    return this.getValue('HOST');
  }

  /** Port the application listens on. */
  get port(): number {
    return this.getValue('PORT');
  }

  /** Whether the MCP Streamable HTTP transport is enabled. */
  get mcpHttpEnabled(): boolean {
    return this.getValue('MCP_HTTP_ENABLED') === 'true';
  }

  /** Whether the MCP STDIO transport is enabled. */
  get mcpStdioEnabled(): boolean {
    return this.getValue('MCP_STDIO_ENABLED') === 'true';
  }

  /** Whether approval is required before protected operations are executed. */
  get approvalRequired(): boolean {
    return this.getValue('APPROVAL_REQUIRED') === 'true';
  }

  /** Root directories that filesystem operations are allowed to access. */
  get filesystemAllowedRoots(): string {
    return this.getValue('FILESYSTEM_ALLOWED_ROOTS');
  }

  /** Directory used to store Projectron's local files and JSON data. */
  get storagePath(): string {
    return this.getValue('STORAGE_PATH');
  }

  /** Minimum application log level to output. */
  get logLevel(): Environment['LOG_LEVEL'] {
    return this.getValue('LOG_LEVEL');
  }
}
