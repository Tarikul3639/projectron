import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from './app.config.js';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

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

  /** OpenAI-compatible API base URL used by the orchestration provider. */
  get aiBaseUrl(): string {
    return this.getValue('AI_BASE_URL');
  }

  /** Optional API key; absence disables AI-backed planning without affecting the app. */
  get aiApiKey(): string | undefined {
    return this.configService.get<string>('AI_API_KEY')?.trim() || undefined;
  }

  /** Model identifier sent to the configured AI provider. */
  get aiModel(): string {
    return this.getValue('AI_MODEL');
  }

  /** Maximum duration of one AI provider request. */
  get aiTimeoutMs(): number {
    return this.getValue('AI_TIMEOUT_MS');
  }

  /** Root directories that filesystem operations are allowed to access. */
  get filesystemAllowedRoots(): string {
    return this.getValue('FILESYSTEM_ALLOWED_ROOTS');
  }

  /** Directory used to store Projectron's local files and JSON data. */
  get storagePath(): string {
    return './storage';
  }

  /** Minimum application log level to output. */
  get logLevel(): Environment['LOG_LEVEL'] {
    return this.getValue('LOG_LEVEL');
  }
}
