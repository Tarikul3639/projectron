# MCP Tools

Projectron exposes feature capabilities as MCP tools. Tool names and input schemas are defined in each module's tools provider and validated with Zod.

## Capability groups

| Module            | What it provides                                                                                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Browser**       | Chromium sessions and tabs, navigation, text/DOM/accessibility inspection, page interaction, screenshots, viewport/device emulation, uploads/downloads, PDFs, tracing, and diagnostics. See [Browser Automation](browser-automation.md). |
| **Documents**     | Text documents, DOCX/XLSX/PPTX/PDF creation and reading, Office inspection, supported conversions, and document templates. See [Office and Document Support](document-support.md).                                                       |
| **Filesystem**    | File and directory listing, recursive trees, reading, writing, searching, editing, copy/move/rename/delete, and staged large-file transfers inside configured roots.                                                                     |
| **Network**       | Local address information, DNS lookups, public-host connectivity and port checks, and bounded HTTP requests. Private/local destinations are restricted by the network services.                                                          |
| **Processes**     | Start and supervise processes launched through this Projectron instance, including status and captured stdout/stderr.                                                                                                                    |
| **Projects**      | Create and import project workspaces, list and verify registered projects, update metadata, archive, restore, remove registry entries, and discover likely project directories.                                                          |
| **System**        | Read host information, CPU and memory metrics, Linux disk I/O and temperatures, top processes, and performance diagnostics.                                                                                                              |
| **Terminal**      | Run one supported non-interactive executable with separate arguments and bounded output/time.                                                                                                                                            |
| **Orchestration** | Discover registered tools, create plans, generate plans from goals, execute one eligible step, inspect tasks, update steps, and cancel tasks.                                                                                            |

## Documents tools

All document MCP tools are registered from the single provider `src/modules/documents/tools/documents.tools.ts`. Format-specific implementation is kept in focused services under `src/modules/documents/services/`; schemas and inferred types remain consolidated in their existing files.

| Tool                            | Purpose                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `documents_capabilities`        | List formats, supported operations, limits, conversions, and restrictions.              |
| `documents_read`                | Read Markdown, TXT, HTML, JSON, CSV, XML, or YAML.                                      |
| `documents_inspect`             | Inspect text-document size and content statistics.                                      |
| `documents_create`              | Create a supported text document.                                                       |
| `documents_convert`             | Convert supported text-based formats.                                                   |
| `documents_generate_template`   | Generate README, API, architecture, user-guide, or changelog templates.                 |
| `documents_create_word`         | Create a DOCX with headings, paragraphs, bullets, and simple tables.                    |
| `documents_read_word`           | Extract plain text and metadata from DOCX.                                              |
| `documents_create_spreadsheet`  | Create XLSX workbooks with multiple sheets, headers, rows, filters, and frozen headers. |
| `documents_read_spreadsheet`    | Read XLSX worksheet names, dimensions, headers, and cell values.                        |
| `documents_create_presentation` | Create PPTX slides with titles, body text, bullets, and speaker notes.                  |
| `documents_read_presentation`   | Extract visible text and slide count from PPTX.                                         |
| `documents_create_pdf`          | Create a searchable, text-first PDF with A4 or Letter pages.                            |
| `documents_read_pdf`            | Extract selectable PDF text and page metadata.                                          |
| `documents_inspect_office`      | Inspect DOCX, XLSX, PPTX, or PDF metadata.                                              |
| `documents_convert_office`      | Convert supported Office/PDF formats to specified text or PDF targets.                  |

### Supported formats and conversion matrix

- **Text:** Markdown, TXT, HTML, JSON, CSV, XML, YAML.
- **Modern Microsoft Office Open XML:** DOCX, XLSX, PPTX.
- **PDF:** create, read selectable text, inspect page metadata.

| Source                 | Supported destinations                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| DOCX                   | TXT, HTML, PDF                                                              |
| XLSX                   | CSV, JSON, TXT, PDF                                                         |
| PPTX                   | TXT, PDF                                                                    |
| PDF                    | TXT                                                                         |
| Supported text formats | Supported text formats via `documents_convert` / `documents_convert_office` |

Office-to-PDF conversion is text-first and does not reproduce original page layouts, charts, or styling. PDF text extraction does not OCR scanned pages. Legacy binary Office formats (.doc, .xls, .ppt) and OpenDocument formats (.odt, .ods, .odp) are not supported by the Office services. DOCX image insertion, XLSX native charts, PPTX editing, and advanced Office layout operations are not currently implemented.

### Limits and safety

- Text documents are limited to 1 MB.
- Office/PDF binary files are limited to 50 MB for reads and writes.
- Spreadsheet generation accepts up to 10,000 data rows per worksheet and up to 50 worksheets.
- Presentation generation accepts up to 100 slides.
- Paths are relative to configured filesystem roots. Absolute paths and traversal are rejected by the document file tools.
- Symlink destinations are rejected for binary writes.
- `.env` and `.env.*` files are protected; `.env.example` is allowed.
- Existing destinations are not replaced unless `overwrite=true` is supplied.

## Browser tools

Browser tools use isolated Chromium contexts. The main tool groups are:

- **Session lifecycle:** `browser_launch`, `browser_close`, `browser_list`, `browser_new_context`, `browser_new_page`, `browser_close_page`, and `browser_close_session`.
- **Navigation and inspection:** `browser_navigate`, history/reload tools, `browser_page_info`, text/HTML/DOM/accessibility extraction, and link/image inspection.
- **Interaction:** wait for element or URL, click/hover/fill/check, select options, press keys, scroll, drag and drop, and handle dialogs.
- **Artifacts:** viewport, full-page, or selected-element screenshots; page-to-PDF; Playwright trace archives.
- **Transfers:** file upload and browser download capture/save/cancel.
- **Diagnostics and state:** network, console, and page errors; performance information; cookies and web storage; viewport/device emulation.

See [Browser Automation](browser-automation.md) for launch, screenshot, download, and security examples.

## Other operational notes

### Process visibility

`process_list`, `process_status`, `process_logs`, and `process_stop` operate only on processes started and tracked by the current Projectron instance. They do not enumerate or control arbitrary OS processes or services started outside Projectron. Use `system_top_processes` for system-wide process inspection on Linux, or an appropriately permitted `terminal_execute` command for OS-level diagnostics.

### Project registry

Project archive, restore, and remove operations affect the Projectron project registry. Removing a registry entry does not delete the project directory or its source files.

### Filesystem and network boundaries

Filesystem paths are resolved under configured allowed roots. Path traversal and unsafe symlink operations are rejected. Network HTTP and connectivity tools validate destinations and restrict private/local network access. Browser navigation has its own URL validation and permits loopback development servers while blocking private LAN, link-local, and internal destinations.

### Orchestration usage

A typical controlled workflow is:

1. Call `orchestration_list_tools` to discover capabilities.
2. Create a plan with `orchestration_create_plan` or `orchestration_plan_from_goal`.
3. Inspect it with `orchestration_get_task`.
4. Call `orchestration_execute_next` to execute at most one eligible step.
5. Inspect the result and repeat until the task is complete.

Creating a plan does not execute tools. Each execution call advances at most one step.

## Runtime discovery and execution model

The exact registered tool list is available at runtime through `orchestration_list_tools`. This reflects the tools actually discovered by the MCP registry and is the source of truth for a connected server.

Every tool validates input against its declared schema. Tool handlers execute directly when input validation and domain-specific restrictions pass. MCP read-only and destructive-operation annotations describe tool impact to compatible clients; they do not add a server-side interactive confirmation or approval step.
