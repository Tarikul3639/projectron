import { Module } from '@nestjs/common';
import { McpModule as NestMcpModule } from '@nestjs/mcp';

// Registers Projectron's MCP tools and exposes them over Streamable HTTP at /mcp.
@Module({
  imports: [
    NestMcpModule.forRoot({
      name: 'Projectron',
      version: '0.0.1',
      title: 'Projectron',
      description: 'Your AI-Powered Project Companion',
      instructions:
        'Use Projectron tools to work with the local workspace. Protected operations require explicit user approval. When a tool requests elicitation, present the approval prompt to the user and do not infer or fabricate their decision.',
    }),
  ],
})
export class McpModule {}
