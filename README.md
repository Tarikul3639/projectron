# Projectron — Local MCP Server for AI-Powered Computer Automation

<p align="center">
  <a href="logo/projectron_256x256_10KB.png">
    <img src="logo/projectron_256x256_10KB.png" width="160" alt="Projectron local MCP server logo for AI-powered computer automation" />
  </a>
</p>

<p align="center">
  <strong>Your AI-Powered Project Companion</strong><br />
  Connect MCP-compatible AI clients to tools on your local computer.
</p>

Projectron is a local **Model Context Protocol (MCP) server** built with **NestJS** and **TypeScript**. It provides tools for filesystem access, terminal commands, browser automation, document handling, process management, network information, project workspaces, and system inspection.

## Features

- **MCP transports:** Streamable HTTP and STDIO.
- **Filesystem tools:** Read, write, search, edit, copy, move, delete, and transfer files within configured roots.
- **Terminal tools:** Run supported non-interactive commands in permitted working directories.
- **Browser automation:** Isolated Chromium contexts, navigation, DOM/accessibility inspection, interaction, screenshots, PDFs, traces, and downloads.
- **Document tools:** Read and create text documents, DOCX, XLSX, PPTX, and searchable text-first PDFs; inspect and convert supported formats.
- **Process management:** Start and supervise processes launched through Projectron.
- **Project workspaces:** Register, import, inspect, archive, restore, and discover project directories.
- **System and network tools:** Host diagnostics, DNS, public connectivity, and bounded HTTP requests.
- **Activity logging:** Store compact MCP tool input/output records with redaction and bounded retention.
- **Local database:** Persist application data in local files without requiring an external database server; JSON and JSONL files are stored under `database/`.

## Requirements

- Node.js **20.19 or newer**
- pnpm
- Chromium dependencies supported by Playwright for browser automation

## Installation

```bash
git clone https://github.com/Tarikul3639/Projectron.git
cd Projectron
pnpm install
cp .env.example .env
```

Review `.env` before starting. Configure the allowed filesystem roots and the MCP transports you intend to use.

## Connect an MCP Client

### Streamable HTTP

```bash
pnpm start:dev
```

Use this MCP endpoint:

```text
http://127.0.0.1:3639/mcp
```

### STDIO

```bash
pnpm build
pnpm start:mcp:stdio
```

Configure your local MCP client to launch the STDIO command from the Projectron directory. STDIO and HTTP are separate transports.

## Development

```bash
pnpm start:dev
pnpm build
pnpm lint
pnpm test
pnpm test:e2e
```

## Documentation

See the [documentation index](docs/README.md):

- [Installation and Running](docs/installation.md)
- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [MCP Client Connection](docs/client-connection.md)
- [MCP Tools Reference](docs/tools.md)
- [Browser Automation](docs/browser-automation.md)
- [Office and Document Support](docs/document-support.md)
- [Logging and Error Reporting](docs/logging-and-errors.md)

## Security

Configure filesystem roots carefully. Projectron applies workspace boundaries, path traversal and symlink checks, protected environment-file handling, bounded command execution, and destination validation for outbound network requests. These controls are not an operating-system-level sandbox; run Projectron with an account whose OS permissions are appropriately limited.

## Technology

NestJS 12 · TypeScript · Model Context Protocol (MCP) · Playwright · Zod · pnpm

## Author

**Tarikul Islam**  
Portfolio: [tarikul-islam.me](https://tarikul-islam.me/)  
GitHub: [github.com/Tarikul3639](https://github.com/Tarikul3639)
