import { Module } from '@nestjs/common';
import { McpModule as NestMcpModule } from '@nestjs/mcp';
import { McpRegistryService } from './mcp.registry.js';
import { MCP_HTTP_PATH } from './transports/http.transport.js';

// NestJS discovers decorated providers across the application and serves them over Streamable HTTP.
@Module({
  imports: [
    NestMcpModule.forRoot({
      path: MCP_HTTP_PATH,
      name: 'Projectron',
      version: '0.0.1',
      title: 'Projectron',
      description: 'Your AI-Powered Project Companion',
      instructions:
        'Use Projectron tools to work with the local workspace. Protected operations are independently enforced by Projectron server-side approval checks. The host application may show its own confirmation before invoking write or destructive tools; never treat tool annotations or host confirmation UI as a replacement for server-side authorization.',
      http: {
        legacy: 'stateless',
        responseMode: 'auto',
      },
      stdio: {
        legacy: 'serve',
      },
    }),
  ],
  providers: [McpRegistryService],
  exports: [NestMcpModule, McpRegistryService],
})
export class McpModule {}
