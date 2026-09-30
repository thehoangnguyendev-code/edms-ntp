-- V500: Single-row Uncontrolled Copy policy settings (mirrors controlled_copy_policy_settings'
-- single-row pattern, simplified per plan: no expiry-limits sub-table, no DCO delivery
-- redirection). Also seeds the DCO-zip-equivalent distribution email template.

CREATE TABLE uncontrolled_copy_policy_settings (
    id                          UUID PRIMARY KEY,

    -- Eligibility (the actual per-type gate lives on document_types.allow_uncontrolled_copy;
    -- this only controls whether an approval step is required before generation)
    approval_required          BOOLEAN NOT NULL DEFAULT TRUE,

    -- Validity
    validity_hours              INTEGER NOT NULL DEFAULT 72,
    allow_redownload            BOOLEAN NOT NULL DEFAULT TRUE,

    -- Mandatory watermark/stamp marking config, ControlledCopyStatusMarking-shaped (jsonb)
    marking                     JSONB,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO uncontrolled_copy_policy_settings (id, approval_required, validity_hours, allow_redownload, marking)
VALUES (
    '00000000-0000-0000-0000-000000000301',
    TRUE,
    72,
    TRUE,
    '{
        "watermarkEnabled": true,
        "watermarkLayer": "ABOVE",
        "watermarkText": "UNCONTROLLED COPY",
        "watermarkColor": "#C00000",
        "watermarkOpacityPercent": 25,
        "watermarkAngleDegrees": 35,
        "watermarkFontFamily": "NOTO_SANS",
        "watermarkShowDate": true,
        "watermarkPages": "ALL",
        "stampEnabled": true,
        "stampText": "UNCONTROLLED COPY",
        "stampColor": "#C00000",
        "stampPosition": "TOP_RIGHT",
        "stampMarginMm": 4,
        "stampSize": "SMALL",
        "stampOpacityPercent": 90,
        "stampShowDate": true,
        "stampFontFamily": "NOTO_SANS",
        "stampPages": "ALL",
        "placements": []
    }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO email_templates (id, name, type, subject, content, status, description, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000501',
    'Uncontrolled Copy Distribution',
    'uncontrolled-copy-distribution',
    'Uncontrolled Copy Available: {documentNumber} - {documentTitle}',
    '<p>Hello {recipientName},</p><p>An uncontrolled copy of the following document has been issued for your reference:</p><p><strong>{documentNumber} - {documentTitle}</strong> (Revision {revisionNumber})</p><p>This copy is marked UNCONTROLLED COPY - NOT VALID FOR PRODUCTION USE and is valid for reference only at the time of issue ({issuedAt}). It is not tracked for recall and may become out of date at any time.</p><p>Sign in to download it: <a href="{downloadLink}">{downloadLink}</a></p><p>Best regards,<br/>EQMS System</p>',
    'Active',
    'Sent when an uncontrolled copy is distributed to a recipient, mirroring the Controlled Copy DCO batch-zip email.',
    'System'
)
ON CONFLICT (id) DO NOTHING;
