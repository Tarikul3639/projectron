# Projectron Documentation

Use this page to find the guide for the task you are working on.

## Getting started

- [Installation and Running](installation.md) — prerequisites, dependency installation, HTTP and STDIO startup, and quality checks.
- [Configuration](configuration.md) — environment variables, defaults, validation, and local storage location.
- [MCP Client Connection](client-connection.md) — connect a local client or forward the HTTP endpoint through a Control Plane tunnel.

## Capabilities

- [MCP Tools Reference](tools.md) — module overview, tool groups, execution behavior, and safety boundaries.
- [Browser Automation](browser-automation.md) — Chromium sessions, page interaction, screenshots, viewport/device emulation, downloads, PDFs, and tracing.
- [Office and Document Support](document-support.md) — text formats, DOCX, XLSX, PPTX, PDF, examples, conversion support, and limits.
- [Orchestration](orchestration.md) — plan creation, AI-assisted planning, step execution, retry, and cancellation.

## Engineering and operations

- [Architecture](architecture.md) — application modules, request flow, transports, persistence, and trust boundaries.
- [Logging and Error Reporting](logging-and-errors.md) — operation lifecycle logs, error propagation, sensitive data, and filesystem-root troubleshooting.

The repository's [README](../README.md) provides the project overview and quick-start instructions. The registered MCP tool list exposed by a running server can be checked with `orchestration_list_tools`; runtime discovery is the source of truth if this reference and the connected server differ.
