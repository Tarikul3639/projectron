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
- Office-to-PDF uses LibreOffice's native rendering engine by default to retain the source document's page layout, fonts, spacing, tables, graphics, and charts as far as the renderer supports them. The tool fails without creating an output PDF if no compatible renderer is available; it never silently falls back to text reconstruction.
- Set `pdfMode: "text-first"` only when a simplified PDF containing extracted text is acceptable. This explicit mode does not preserve the original Office layout.
- documents_convert remains available for text formats such as Markdown, TXT, HTML, JSON, and CSV.

## File safety and limits

All paths must be relative to a configured filesystem root. Path traversal and absolute paths are rejected. Protected .env files remain inaccessible, except .env.example. Binary reads and writes are limited to 50 MiB; text-document operations retain their existing 1 MiB limit. Existing files are preserved unless overwrite=true is explicitly supplied.


## Word template editing

Use `documents_edit_word_template` when an existing DOCX must keep its original design and only its content needs to change. The tool reads the original OOXML package, replaces exact text or placeholders in Word text runs, and writes a separate output DOCX.

Example input:

```json
{
  "sourcePath": "templates/Tarikul_Islam_Resume_V6.docx",
  "destinationPath": "resumes/Company-A/Tarikul_Islam_Resume.docx",
  "replacements": [
    { "find": "{{COMPANY}}", "replaceWith": "Company A" },
    { "find": "{{ROLE}}", "replaceWith": "Backend Developer" }
  ],
  "requireAll": true,
  "overwrite": false,
  "clientId": "resume-generator"
}
```

The source template is never edited in place. Formatting, paragraph/run properties, styles, page settings, headers, footers, and other existing DOCX package parts are preserved because the tool edits the existing OOXML instead of rebuilding the document from structured content. Placeholders that span multiple Word text runs are supported. By default every requested replacement must be found before the output is written.
