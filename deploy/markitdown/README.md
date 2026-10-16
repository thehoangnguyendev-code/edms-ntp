# MarkItDown in Docker

[MarkItDown](https://github.com/microsoft/markitdown) (Microsoft, MIT licence) converts Word, PowerPoint, Excel, PDF and Outlook files to Markdown.
It runs here as a **tool that is started when needed**, not as a service that stays up. Version 0.1.8, pinned in `Dockerfile`.

## Use

Put the files in `io/markitdown/` (git ignores the folder), then:

```bash
# first time, or after changing the Dockerfile
docker compose --profile tools build markitdown

# convert one file; the result is written next to it
docker compose --profile tools run --rm markitdown report.docx -o report.md

# write to the screen instead
docker compose --profile tools run --rm markitdown report.pdf
```

`docker compose up` does not start it (profile `tools`).

## What it can and cannot do

- Converters installed: `.docx`, `.pptx`, `.xlsx`, `.xls`, `.pdf`, Outlook `.msg`, and the formats MarkItDown reads without extras (HTML, CSV, JSON, XML, ZIP, plain text, EPub).
- Not installed: audio transcription, YouTube, Azure Document Intelligence. Add them in the `pip install` line of the `Dockerfile` if a need appears.
- A scanned PDF (a picture of a page) gives little or no text: MarkItDown reads text, it does not do OCR.

## Safety

- **No network** (`network_mode: none`): a link inside a file cannot make the container fetch a page, and a converted file never leaves the machine.
  Because of this, a web address as the input does not work; download the file first.
- Read-only system, all capabilities dropped, `no-new-privileges`, runs as an unprivileged user (uid 10001), memory limit as the other services.
- Only `io/markitdown/` is visible to it, and it is writable there.
- It is a DEV helper. It is not part of the eQMS application and nothing in the application calls it. Files of regulated records converted with it are copies;
  keep the original as the record.

## If you want the application to call it

That would be a separate change: a small service with its own authentication and a decision about which files may be sent to it. MarkItDown also publishes
`markitdown-mcp` (an MCP server for local agents); its own documentation says it is meant for local use and must not be exposed to the network.
