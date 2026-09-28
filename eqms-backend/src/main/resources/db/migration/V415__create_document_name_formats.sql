-- Document Name Formats: an ordered composition of Document Components joined by a separator
-- (Phase 1 -- catalog management only; not yet wired into live document-number generation, see
-- the feature plan). Formats are never hard-deleted (Deactivate instead), same GMP data-integrity
-- reasoning already applied to document_types/document_sub_types.
CREATE TABLE document_name_formats (
    id          UUID PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    separator   VARCHAR(10)  NOT NULL DEFAULT '',
    description VARCHAR(512),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_document_name_formats_name UNIQUE (name)
);

CREATE TABLE document_name_format_components (
    id             UUID PRIMARY KEY,
    format_id      UUID    NOT NULL REFERENCES document_name_formats(id) ON DELETE CASCADE,
    component_id   UUID    NOT NULL REFERENCES document_components(id),
    display_order  INTEGER NOT NULL,
    CONSTRAINT uq_document_name_format_components UNIQUE (format_id, component_id)
);

CREATE INDEX idx_document_name_format_components_format ON document_name_format_components(format_id);
CREATE INDEX idx_document_name_format_components_component ON document_name_format_components(component_id);

-- Seed a "Standard" format matching the document-numbering scheme already live today
-- (DocumentType.SerialNumber, e.g. "SOP.0007") so the catalog isn't empty on first use, and so a
-- later Phase 2 migration has an existing row to default every Document Type onto without
-- changing any already-issued document number.
INSERT INTO document_name_formats (id, name, separator, description, is_active)
VALUES ('00000000-0000-0000-0000-000000000101', 'Standard Document Number Format', '.',
        'Format: <Document Type>.<Serial Number> -- matches the document numbering scheme already in use (e.g. SOP.0007).', TRUE);

INSERT INTO document_name_format_components (id, format_id, component_id, display_order)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000101', dc.id, seq.display_order
FROM document_components dc
JOIN (VALUES ('documentType', 10), ('serial_number', 20)) AS seq(value, display_order)
    ON dc.value = seq.value;
