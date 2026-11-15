import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from './app.config.js';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  private getValue<K extends keyof Environment>(key: K): Environment[K] {
    return this.configService.getOrThrow<Environment[K]>(key);
  }

  get nodeEnv(): Environment['NODE_ENV'] {
    return this.getValue('NODE_ENV');
  }
  get host(): string {
    return this.getValue('HOST');
  }
  get port(): number {
    return this.getValue('PORT');
  }
  get mcpHttpEnabled(): boolean {
    return this.getValue('MCP_HTTP_ENABLED') === 'true';
  }
  get mcpStdioEnabled(): boolean {
    return this.getValue('MCP_STDIO_ENABLED') === 'true';
  }
  get filesystemAllowedRoots(): string {
    return this.getValue('FILESYSTEM_ALLOWED_ROOTS');
  }
  get databasePath(): string {
    return './database';
  }
  get logLevel(): Environment['LOG_LEVEL'] {
    return this.getValue('LOG_LEVEL');
  }
}
