# Projectron — Local MCP Server for AI-Powered Computer Automation

<p align="center">
  <a href="logo/projectron_256x256_10KB.png">
    <img src="logo/projectron_256x256_10KB.png" width="160" alt="Projectron local MCP server logo for AI-powered computer automation" />
  </a>
</p>

<p align="center">
  <strong>Your AI-Powered Project Companion</strong><br />
  Connect MCP-compatible AI clients to tools and workflows on your local computer.
</p>

Projectron is a local **Model Context Protocol (MCP) server** built with **NestJS** and **TypeScript**. It gives compatible AI assistants a structured way to interact with your computer through tools for filesystem access, terminal commands, browser automation, document handling, process management, network information, project workspaces, and system inspection. Tools execute directly after input validation and domain-specific restrictions pass; destructive-operation annotations remain impact metadata for MCP clients.

## Features

- **MCP transports:** Connect through Streamable HTTP or STDIO.
- **Filesystem tools:** Read, write, search, edit, copy, move, delete, and transfer files within configured allowed roots.
- **Terminal tools:** Run supported non-interactive commands in permitted working directories.
- **Browser automation:** Use isolated Chromium contexts and tabs to navigate, inspect DOM/accessibility data, interact with pages, emulate viewports/devices, capture screenshots, create PDFs, trace sessions, and manage downloads.
- **Document tools:** Read and create text documents, DOCX, XLSX, PPTX, and searchable text-first PDFs; inspect and convert supported formats.
- **Process management:** Start and supervise processes launched through Projectron. System-wide process inspection is available separately through system diagnostics.
- **Project workspaces:** Register, import, inspect, archive, restore, and discover project directories.
- **System and network tools:** Inspect host metrics and diagnostics, resolve DNS, test public connectivity, and make bounded HTTP requests.
- **Orchestration:** Create validated multi-step plans and execute one dependency-ready step per call.
- **Local storage:** Persist application data in local JSON files without requiring a database.

## Requirements

- Node.js **20.19 or newer**
- pnpm
- Chromium dependencies supported by Playwright for browser automation

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Tarikul3639/Projectron.git
cd Projectron
pnpm install
cp .env.example .env
```

Review the `.env` file before starting. Configure the allowed filesystem roots and enable the MCP transports you intend to use.

## Connect an MCP Client

### Streamable HTTP

Start the development server:

```bash
pnpm start:dev
```

Use this MCP endpoint in an MCP-compatible client:

```text
http://127.0.0.1:3639/mcp
```

Adjust the host or port if you changed the corresponding environment settings.

### STDIO

Build and start the dedicated STDIO MCP process:

```bash
pnpm build
pnpm start:mcp:stdio
```

Configure your local MCP client to launch the STDIO command from the Projectron directory. STDIO and HTTP are separate transports; the STDIO process does not expose the HTTP endpoint.

## Development

```bash
pnpm start:dev   # Start in watch mode
pnpm build       # Build the application
pnpm lint        # Run lint checks
pnpm test        # Run unit tests
pnpm test:e2e    # Run end-to-end tests
```

## Documentation

The [documentation index](docs/README.md) links to the full guides:

- [Installation and Running](docs/installation.md)
- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [MCP Client Connection](docs/client-connection.md)
- [MCP Tools Reference](docs/tools.md)
- [Browser Automation](docs/browser-automation.md)
- [Office and Document Support](docs/document-support.md)
- [Orchestration](docs/orchestration.md)
- [Logging and Error Reporting](docs/logging-and-errors.md)

## Logs and Errors

Projectron logs the start, successful completion, duration, and actual failure details for Nest-managed operations, including MCP tool handlers. Known framework errors are preserved; unexpected runtime failures are surfaced to MCP clients with their original diagnostic message and error code instead of a generic error. Batch operations also log partial failures. Request payloads and complete document contents are not logged to avoid exposing secrets or private data.

See [Logging and Error Reporting](docs/logging-and-errors.md) for log fields and filesystem-root troubleshooting.

## Security

Configure filesystem roots carefully. Projectron retains domain-specific restrictions such as workspace boundaries, path traversal and symlink checks, protected environment-file handling, bounded command execution, blocked interactive shells and interpreters, and public-destination validation for outbound network requests. Browser navigation blocks private and internal network destinations by default while allowing local loopback development servers. These controls are not an operating-system-level sandbox; run Projectron with an account whose OS permissions are appropriately limited.

## Technology

NestJS 12 · TypeScript · Model Context Protocol (MCP) · Playwright · Zod · pnpm

## Author

**Tarikul Islam**  
Portfolio: [tarikul-islam.me](https://tarikul-islam.me/)  
GitHub: [github.com/Tarikul3639](https://github.com/Tarikul3639)
