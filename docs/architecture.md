# Projectron Architecture

## Goal

Projectron is a local-first assistant backend. It exposes workspace, browser, document, system, network, process, and workspace registry capabilities as MCP tools.

## Technology

- NestJS 12 and TypeScript
- `@nestjs/mcp` for MCP tool discovery and transports
- Zod schemas for tool input validation
- Playwright for browser automation
- JSON files for local application state
- Vitest, Oxlint, and Prettier for quality checks

## Application structure

```text
src/
├── main.ts
├── app.module.ts
├── config/
├── core/
│   └── coordination/
└── modules/
    ├── activity-logging/
    ├── browser/
    ├── documents/
    ├── filesystem/
    ├── mcp/
    ├── network/
    ├── processes/
    ├── workspaces/
    ├── storage/
    ├── system/
    └── terminal/
```

## Module boundaries

Each feature module owns its services, validation schemas, and MCP tool provider. Tool providers expose capabilities; services implement the actual work. Documents delegates DOCX, XLSX, PPTX, PDF, and conversion work to focused services.

- **Config** validates environment variables and provides typed settings.
- **Core** contains low-level shared infrastructure such as coordination.
- **Storage** provides file and JSON persistence.
- **MCP** discovers decorated providers and exposes them to clients.
- **Activity Logging** captures only MCP tool input/output and compact execution metadata.

## Request flow

1. A client connects through MCP Streamable HTTP or the stdio entry point.
2. `@nestjs/mcp` discovers methods decorated with `@Tool()`.
3. Zod input schemas validate tool arguments.
4. The owning module performs the operation and applies its own safety checks.
5. Persistent state is stored through Storage where required.
6. The tool returns its result to the MCP client.

## MCP transports

- **HTTP:** `McpModule.forRoot({ path: 'mcp', ... })` registers Streamable HTTP.
- **STDIO:** `src/modules/mcp/transports/stdio.transport.ts` creates a standalone Nest application context.

## Persistence

Application data is stored locally under `storage/`. The Storage module wraps filesystem operations and JSON serialization. Feature services own their persisted data.

## Safety boundaries

- Filesystem access is restricted to configured allowed roots.
- Destructive-operation annotations describe impact; they do not add an interactive server-side authorization stage.
- Browser navigation blocks private and internal network destinations, subject to browser URL checks.
