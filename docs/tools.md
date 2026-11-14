# MCP Tools

Projectron exposes feature capabilities as MCP tools. Tool names and input schemas are defined in each module's tools provider and validated with Zod.

## Capability groups

| Module            | What it provides                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Browser**       | Launch and manage Chromium sessions, navigate pages, inspect text/DOM/accessibility/links, interact with elements, capture screenshots, and manage downloads. |
| **Documents**     | Read and write text documents, create and read DOCX/XLSX/PPTX/PDF files, inspect Office metadata, convert supported formats, and generate document templates. |
| **Filesystem**    | Read, write, list, create, edit, move, copy, delete, and transfer files and directories within allowed roots.                                                 |
| **Network**       | Inspect local addresses, perform DNS lookups, test connectivity, and make controlled HTTP requests.                                                           |
| **Processes**     | Execute and supervise processes and manage their working directories.                                                                                         |
| **Projects**      | List, inspect, add, update, remove, and discover project directories.                                                                                         |
| **System**        | Read host information, CPU and memory metrics, disk I/O, temperatures, top processes, and performance diagnostics.                                            |
| **Terminal**      | Run supported terminal commands and retrieve execution results.                                                                                               |
| **Orchestration** | Discover tools, create plans, generate plans from goals, execute one eligible step, inspect tasks, update steps, and cancel tasks.                            |

## Documents tools

All document MCP tools are registered from the single provider src/modules/documents/tools/documents.tools.ts. Format-specific implementation is kept in focused services under src/modules/documents/services/; schemas and inferred types remain consolidated in their existing files.

| Tool                          | Purpose                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| documents_capabilities        | List formats, supported operations, limits, conversions, and restrictions.              |
| documents_read                | Read Markdown, TXT, HTML, JSON, CSV, XML, or YAML.                                      |
| documents_inspect             | Inspect text-document size and content statistics.                                      |
| documents_create              | Create a supported text document.                                                       |
| documents_convert             | Convert supported text-based formats.                                                   |
| documents_generate_template   | Generate README, API, architecture, user-guide, or changelog templates.                 |
| documents_create_word         | Create a DOCX with headings, paragraphs, bullets, and simple tables.                    |
| documents_read_word           | Extract plain text and metadata from DOCX.                                              |
| documents_create_spreadsheet  | Create XLSX workbooks with multiple sheets, headers, rows, filters, and frozen headers. |
| documents_read_spreadsheet    | Read XLSX worksheet names, dimensions, headers, and cell values.                        |
| documents_create_presentation | Create PPTX slides with titles, body text, bullets, and speaker notes.                  |
| documents_read_presentation   | Extract visible text and slide count from PPTX.                                         |
| documents_create_pdf          | Create a searchable, text-first PDF with A4 or Letter pages.                            |
| documents_read_pdf            | Extract selectable PDF text and page metadata.                                          |
| documents_inspect_office      | Inspect DOCX, XLSX, PPTX, or PDF metadata.                                              |
| documents_convert_office      | Convert supported Office/PDF formats to specified text or PDF targets.                  |

### Supported formats

- Text: Markdown, TXT, HTML, JSON, CSV, XML, YAML.
- Modern Microsoft Office Open XML: DOCX, XLSX, PPTX.
- PDF: create, read selectable text, inspect page metadata.

### Office conversion matrix

| Source                 | Supported destinations                                                  |
| ---------------------- | ----------------------------------------------------------------------- |
| DOCX                   | TXT, HTML, PDF                                                          |
| XLSX                   | CSV, JSON, TXT, PDF                                                     |
| PPTX                   | TXT, PDF                                                                |
| PDF                    | TXT                                                                     |
| Supported text formats | Supported text formats via documents_convert / documents_convert_office |

Office-to-PDF conversion is text-first and does not reproduce original page layouts, charts, or styling. PDF text extraction does not OCR scanned pages. Legacy binary Office formats (.doc, .xls, .ppt) and OpenDocument formats (.odt, .ods, .odp) are not supported by the Office services. DOCX image insertion, XLSX native charts, PPTX editing, and advanced Office layout operations are not currently implemented.

### Limits and safety

- Text documents are limited to 1 MB.
- Office/PDF binary files are limited to 50 MB for reads and writes.
- Spreadsheet generation accepts up to 10,000 data rows per worksheet and up to 50 worksheets.
- Presentation generation accepts up to 100 slides.
- Paths are relative to configured filesystem roots. Absolute paths and traversal are rejected.
- Symlink destinations are rejected for binary writes.
- .env and .env.* files are protected; .env.example is allowed.
- Existing destinations are not replaced unless overwrite=true is supplied.
- Destructive-operation MCP annotations describe impact to compatible clients; they do not add a server-side interactive confirmation step.

## Discover available tools

The exact registered tool list is available at runtime through orchestration_list_tools. This reflects the tools actually discovered by the MCP registry and is the source of truth for a connected server.

## Execution model

- Every tool validates its input against its declared schema.
- Read-only tools are identified with MCP annotations where appropriate.
- Tool handlers execute directly when their input validation and domain-specific restrictions pass.
- Filesystem and browser operations enforce their own access and destination restrictions.
- MCP destructive-operation annotations describe impact to compatible clients; they do not add a server-side interactive confirmation step.

## Orchestration usage

A typical controlled workflow is:

1. Call orchestration_list_tools to discover capabilities.
2. Create a plan with orchestration_create_plan or orchestration_plan_from_goal.
3. Inspect it with orchestration_get_task.
4. Call orchestration_execute_next to execute at most one eligible step.
5. Inspect the result and repeat until the task is complete.

Creating a plan does not execute tools. Each execution call advances at most one step.
