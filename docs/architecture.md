# Projectron Architecture

## Goal

Projectron is a local-first assistant backend. It exposes workspace, browser, document, system, network, process, and project capabilities as MCP tools. AI planning can combine those tools into controlled multi-step tasks.

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
├── main.ts                 # HTTP application bootstrap
├── app.module.ts           # Root module
├── config/                 # Environment validation and typed config
└── modules/
    ├── browser/            # Browser sessions, pages, downloads
    ├── documents/          # Document files, conversion, templates
    ├── filesystem/         # Files, directories, edits, transfers
    ├── mcp/                # MCP server setup and registry
    ├── network/            # Address, DNS, connectivity, HTTP
    ├── orchestration/      # Plans, AI planning, step execution
    ├── processes/          # Process execution and workspace
    ├── projects/           # Project catalog and discovery
    ├── storage/            # File and JSON persistence
    ├── system/             # Host information and diagnostics
    └── terminal/           # Command execution
```

## Module boundaries

Each feature module owns its services, validation schemas, and MCP tool provider. Tool providers expose capabilities; services implement the actual work. Documents keeps one MCP provider and one consolidated schema/type file while delegating DOCX, XLSX, PPTX, PDF, and conversion work to focused services. Shared concerns are kept in dedicated modules:

### Documents module layout

```text
src/modules/documents/
├── documents.module.ts
├── tools/
│   └── documents.tools.ts
├── schemas/
│   └── documents.schemas.ts
├── types/
│   └── documents.type.ts
└── services/
    ├── document-file.service.ts
    ├── document-converter.service.ts
    ├── document-template.service.ts
    ├── word-document.service.ts
    ├── spreadsheet-document.service.ts
    ├── presentation-document.service.ts
    ├── pdf-document.service.ts
    └── office-converter.service.ts
```

The Documents module reuses the same workspace-root path checks for text and binary files. Binary helpers enforce a 50 MiB limit and reject symlink destinations. The MCP provider remains a single file; Office formats do not add separate tool-provider or schema files.

- **Config** validates environment variables and provides typed settings.
- **Storage** provides file and JSON persistence.
- **MCP** discovers decorated providers and exposes them to MCP clients.
- **Orchestration** coordinates registered MCP tools; it does not call domain services directly.

## Request flow

1. A client connects through MCP Streamable HTTP or launches the stdio entry point.
2. `@nestjs/mcp` discovers methods decorated with `@Tool()`.
3. Zod input schemas validate tool arguments.
4. The owning module performs the operation and applies its own safety checks.
5. Persistent state is stored through Storage where required.
6. The tool returns its result to the MCP client.

## MCP transports

- **HTTP:** `McpModule.forRoot({ path: 'mcp', ... })` registers the Streamable HTTP endpoint. The Nest application starts it through `app.listen()` in `src/main.ts`.
- **STDIO:** `src/modules/mcp/transports/stdio.transport.ts` creates a standalone Nest application context and calls `McpStdioServer.listen()`. Run it with `pnpm start:mcp:stdio` after building.

The HTTP transport file only defines the endpoint path; the Nest MCP module implements the transport.

## Persistence

Application data is stored locally under `storage/`. The Storage module wraps filesystem operations and JSON serialization. Current task and project data are persisted by their owning services.

## Safety boundaries

- Filesystem access is restricted to configured allowed roots.
- Destructive-operation annotations describe impact to compatible clients; they do not add an interactive server-side authorization stage.
- Browser navigation blocks private and internal network destinations, subject to the browser module's URL checks.
- Orchestration validates registered tool names, schemas, dependencies, and execution state before dispatch.
- AI-generated plans are treated as untrusted input and are validated before being saved.
