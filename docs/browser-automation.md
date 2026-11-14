# Browser Automation

Projectron uses Playwright with headless Chromium. Browser sessions contain isolated browser contexts, and each context has its own cookies and web storage. A context can contain multiple tabs. Browser session and download records are held in memory and are cleared when their context or the Projectron process is closed.

## Basic workflow

1. Call `browser_capabilities` to confirm the browser features and configured file roots.
2. Call `browser_launch` to start Chromium and create the first isolated context and tab.
3. Call `browser_list` to retrieve current session IDs, page IDs, URLs, and titles.
4. Use `browser_navigate` to open an HTTP or HTTPS page.
5. Inspect the page with `browser_page_info`, `browser_get_text`, `browser_get_dom`, `browser_get_accessibility_tree`, or `browser_get_links`.
6. Interact with elements using `browser_click`, `browser_select_option`, `browser_press_key`, and `browser_scroll`.
7. Close the page, context, or all browser sessions when finished.

When a tool accepts an optional `pageId`, omitting it targets the current default page. Use explicit page IDs when multiple tabs are open so that operations target the intended tab.

## Screenshots

`browser_screenshot` can capture three useful scopes:

- **Viewport:** the currently visible browser viewport (the default).
- **Full page:** the entire scrollable page when `fullPage: true`.
- **Selected element:** only the element matched by a CSS `selector`, such as `#checkout-summary` or `.profile-card`.

A screenshot can be returned directly or saved as a file.

### Return an image directly

Omit `path` to receive a Base64-encoded image with its MIME type and byte size:

```json
{
  "pageId": "PAGE_UUID",
  "selector": "#checkout-summary",
  "type": "png"
}
```

### Save a screenshot into the workspace

Provide an **absolute** destination path inside one of the configured `FILESYSTEM_ALLOWED_ROOTS`:

```json
{
  "pageId": "PAGE_UUID",
  "fullPage": true,
  "type": "png",
  "path": "/absolute/path/inside/workspace/screenshots/account-page.png"
}
```

For a selected element, provide `selector` instead of (or together with) the other screenshot options:

```json
{
  "pageId": "PAGE_UUID",
  "selector": "main .invoice-panel",
  "type": "jpeg",
  "quality": 85,
  "path": "/absolute/path/inside/workspace/screenshots/invoice-panel.jpg"
}
```

The browser artifact service creates missing parent directories, checks the resolved destination against configured roots, and refuses to replace an existing artifact. Choose a new output path when the file already exists. PNG is the default format; JPEG quality can be set from 1 to 100.

The initial viewport is 1440 × 900. Use `browser_set_viewport` or `browser_emulate_device` before capturing when you need a particular responsive layout. Full-page capture is useful for long pages; a CSS selector is the preferred way to capture one component or a specific portion of a page.

## Other browser capabilities

| Capability                | Tools                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions and tabs         | `browser_launch`, `browser_close`, `browser_list`, `browser_new_context`, `browser_new_page`, `browser_close_page`, `browser_close_session`                                           |
| Navigation                | `browser_navigate`, `browser_go_back`, `browser_go_forward`, `browser_reload`, `browser_page_info`                                                                                    |
| Page inspection           | `browser_get_text`, `browser_get_html`, `browser_get_dom`, `browser_get_accessibility_tree`, `browser_get_links`, `browser_get_images`                                                |
| Waiting and interaction   | `browser_wait_for_element`, `browser_wait_for_url`, `browser_click`, `browser_select_option`, `browser_press_key`, `browser_scroll`, `browser_drag_and_drop`, `browser_handle_dialog` |
| Screenshots and artifacts | `browser_screenshot`, `browser_print_to_pdf`, `browser_trace_start`, `browser_trace_stop`                                                                                             |
| Downloads and uploads     | `browser_download`, `browser_get_downloads`, `browser_wait_for_download`, `browser_save_download`, `browser_cancel_download`, `browser_upload_file`                                   |
| Session data              | `browser_get_cookies`, `browser_set_cookies`, `browser_read_storage`, `browser_write_storage`, `browser_clear_session`                                                                |
| Diagnostics               | `browser_network_logs`, `browser_get_console_logs`, `browser_get_errors`, `browser_get_performance`, `browser_evaluate`, `browser_set_viewport`, `browser_emulate_device`             |

## Downloads, uploads, PDFs, and traces

- To capture a download, call `browser_download` with the selector for the download link or button. Use the returned `downloadId` with `browser_wait_for_download`, then save it with `browser_save_download`.
- Download and upload paths must remain inside configured allowed roots. Upload sources must be absolute paths to regular files inside an allowed root; up to 20 files can be uploaded in one call.
- Use `browser_print_to_pdf` to print the current page as an A4 PDF.
- Use `browser_trace_start` before the actions you want to inspect, then `browser_trace_stop` with an absolute output path inside an allowed root to save the trace archive.
- Browser screenshots, PDFs, and traces do not silently replace an existing output file.

## Network and security behavior

- Navigation accepts HTTP and HTTPS URLs.
- Loopback destinations are allowed for local development.
- Private LAN, link-local, and internal network destinations are blocked, including redirected requests.
- Service workers are blocked in newly created browser contexts.
- File uploads, downloads, screenshots, PDFs, and trace archives are constrained to configured filesystem roots.

Browser automation runs on the local machine with the Projectron process's operating-system permissions. Do not use it with untrusted sites or workflows unless the resulting page actions and file transfers are appropriate for the local environment.
