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
        'Use Projectron tools to work with the local workspace. Protected operations require explicit user approval. When a tool requests elicitation, present the approval prompt to the user and do not infer or fabricate their decision.',
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
