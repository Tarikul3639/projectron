# Office and Document Support

The Documents module supports text documents and modern Office Open XML files. MCP tool registration remains centralized in documents.tools.ts, and all new Zod definitions remain in documents.schemas.ts. Format-specific logic lives in separate services.

## Word (DOCX)

Use documents_create_word to create a Word document.

Example input:

{
  "path": "reports/project-report.docx",
  "title": "Project Report",
  "author": "Projectron",
  "sections": [
    {
      "heading": "Executive Summary",
      "level": 1,
      "paragraphs": ["A concise overview of the project."],
      "bullets": ["First outcome", "Second outcome"]
    },
    {
      "heading": "Milestones",
      "level": 2,
      "table": {
        "headers": ["Milestone", "Status"],
        "rows": [["Architecture", "Complete"], ["Office support", "In progress"]]
      }
    }
  ],
  "overwrite": false,
  "clientId": "my-client"
}

Use documents_read_word to extract plain text and document metadata from an existing DOCX. Mammoth warnings are returned when the source contains unsupported or complex structures. Existing DOCX files are not edited in place.

## Excel (XLSX)

Use documents_create_spreadsheet to create a workbook with multiple worksheets.

Example input:

{
  "path": "reports/project-metrics.xlsx",
  "title": "Project Metrics",
  "sheets": [
    {
      "name": "Summary",
      "headers": ["Metric", "Value"],
      "rows": [["Completed tasks", 18], ["Open tasks", 4]],
      "freezeHeader": true,
      "autoFilter": true
    },
    {
      "name": "Workstreams",
      "headers": ["Workstream", "Owner", "Status"],
      "rows": [["Documents", "Team", "Active"]],
      "freezeHeader": true,
      "autoFilter": true
    }
  ],
  "overwrite": false,
  "clientId": "my-client"
}

Use documents_read_spreadsheet to read sheet names, dimensions, headers, and cell values. documents_convert_office can export the first worksheet to CSV or JSON. Cell formulas, native chart authoring, pivot tables, macros, and in-place workbook editing are not currently exposed.

## PowerPoint (PPTX)

Use documents_create_presentation to create a widescreen deck.

Example input:

{
"path": "reports/project-update.pptx",
"title": "Project Update",
"author": "Projectron",
"slides": [
{
"title": "Progress",
"body": "The project is progressing against the planned milestones.",
"bullets": ["Core architecture established", "Office document generation added"],
"notes": "Explain delivery status and outstanding risks."
},
{
"title": "Next Steps",
"bullets": ["Complete integration testing", "Update user documentation"]
}
],
"overwrite": false,
"clientId": "my-client"
}

Use documents_read_presentation to extract visible slide text and slide count. Slide editing, imported templates, embedded images, chart authoring, and layout-preserving re-export are not currently implemented.

## PDF

Use documents_create_pdf to create searchable text-first PDFs. Supports A4 and Letter pages. Use documents_read_pdf to extract selectable text, word/character counts, and page count.

PDF text extraction uses PDF.js. Scanned-image OCR is not performed. PDF generation uses standard PDF fonts and is intended for text-first reports; complex language glyph coverage and advanced page design require a future embedded-font/layout implementation.

## Inspect and convert

- documents_inspect_office returns file metadata and format-specific counts without returning full document bodies.
- documents_convert_office supports DOCX to TXT/HTML/PDF, XLSX to CSV/JSON/TXT/PDF, PPTX to TXT/PDF, and PDF to TXT.
- Office-to-PDF output reconstructs plain text and does not preserve the original Office layout, graphics, tables, or charts.
- documents_convert remains available for text formats such as Markdown, TXT, HTML, JSON, and CSV.

## File safety and limits

All paths must be relative to a configured filesystem root. Path traversal and absolute paths are rejected. Protected .env files remain inaccessible, except .env.example. Binary reads and writes are limited to 50 MiB; text-document operations retain their existing 1 MiB limit. Existing files are preserved unless overwrite=true is explicitly supplied.
