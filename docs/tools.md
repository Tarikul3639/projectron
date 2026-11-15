# MCP Tools

Projectron exposes feature capabilities as MCP tools. Tool names and input schemas are defined in each module's tools provider and validated with Zod.

## Capability groups

| Module               | What it provides                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Activity Logging** | Recent MCP tool input/output records and execution search.                                                                                                                                                                      |
| **Browser**          | Chromium sessions and tabs, navigation, text/DOM/accessibility inspection, page interaction, screenshots, viewport/device emulation, uploads/downloads, PDFs, and diagnostics. See [Browser Automation](browser-automation.md). |
| **Documents**        | Text documents, DOCX/XLSX/PPTX/PDF creation and reading, Office inspection, supported conversions, and document templates. See [Office and Document Support](document-support.md).                                              |
| **Filesystem**       | File and directory listing, recursive trees, reading, writing, searching, editing, copy/move/rename/delete, and staged large-file transfers inside configured roots.                                                            |
| **Network**          | Local address information, DNS lookups, public-host connectivity and port checks, and bounded HTTP requests.                                                                                                                    |
| **Processes**        | Start and supervise processes launched through this Projectron instance.                                                                                                                                                        |
| **Workspaces**         | Create new workspaces with readable folder names, register existing directories by location, and list, verify, update, archive, restore, unregister, or discover workspaces.                                                        |
| **System**           | Host information, CPU and memory metrics, Linux disk I/O and temperatures, top processes, and performance diagnostics.                                                                                                          |
| **Terminal**         | Run one supported non-interactive executable with separate arguments and bounded output/time.                                                                                                                                   |

## Documents tools

All document MCP tools are registered from the single provider `src/modules/documents/tools/documents.tools.ts`. Format-specific implementation is kept in focused services under `src/modules/documents/services/`.

| Tool                                                            | Purpose                                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `documents_capabilities`                                        | List formats, operations, limits, conversions, and restrictions.        |
| `documents_read`                                                | Read Markdown, TXT, HTML, JSON, CSV, XML, or YAML.                      |
| `documents_inspect`                                             | Inspect text-document size and content statistics.                      |
| `documents_create`                                              | Create a supported text document.                                       |
| `documents_convert`                                             | Convert supported text-based formats.                                   |
| `documents_generate_template`                                   | Generate README, API, architecture, user-guide, or changelog templates. |
| `documents_create_word` / `documents_read_word`                 | Create and read DOCX documents.                                         |
| `documents_create_spreadsheet` / `documents_read_spreadsheet`   | Create and read XLSX workbooks.                                         |
| `documents_create_presentation` / `documents_read_presentation` | Create and read PPTX presentations.                                     |
| `documents_create_pdf` / `documents_read_pdf`                   | Create and read searchable PDF documents.                               |
| `documents_inspect_office` / `documents_convert_office`         | Inspect and convert supported Office/PDF formats.                       |

### Supported formats and limits

- Text: Markdown, TXT, HTML, JSON, CSV, XML, YAML.
- Office: DOCX, XLSX, PPTX.
- PDF: create, read selectable text, inspect metadata.
- Text documents: 1 MB maximum.
- Office/PDF binary files: 50 MB maximum.
- Spreadsheet generation: 10,000 rows per worksheet and 50 worksheets.
- Presentation generation: 100 slides.
- Paths are relative to configured filesystem roots; traversal and unsafe symlink destinations are rejected.

## Browser tools

Browser tools use isolated Chromium contexts:

- Session lifecycle: launch, close, list, context/page creation.
- Navigation and inspection: navigation, history, text/HTML/DOM/accessibility, links and images.
- Interaction: wait, click, select, keypress, scroll, drag/drop, dialogs.
- Artifacts: screenshots, PDFs, and Playwright traces.
- Transfers: uploads and downloads.
- Diagnostics: network, console, errors, performance, cookies, and web storage.

See [Browser Automation](browser-automation.md) for examples.

## Other operational notes

- Process inspection covers processes started and tracked by the current Projectron instance. Use system tools for host-wide process inspection.
- Project archive, restore, and remove operations affect the workspace registry; removing a registry entry does not delete workspace files.
- Filesystem paths are restricted to configured roots. Network and browser tools apply destination validation and safety checks.
- Every tool validates input against its declared schema. MCP annotations describe tool impact; they do not add a server-side interactive approval stage.
