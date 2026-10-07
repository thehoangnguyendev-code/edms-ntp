-- Layouts are part of the immutable definition snapshot, not mutable report artefacts.
ALTER TABLE report_definitions ADD COLUMN layout JSONB NOT NULL DEFAULT
'{"cover":false,"coverTitle":"{{report.title}}","subtitle":"","showExecutor":true,"showGeneratedAt":true,"header":"{{report.title}}","footer":"{{report.code}} · v{{template.version}}","pageNumbers":true,"watermarkEnabled":false,"watermark":"FOR PREVIEW ONLY","stampEnabled":false,"stamp":"TEST"}'::jsonb;
