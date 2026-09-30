-- V498: Document Type eligibility gate for Uncontrolled Copy. No implicit eligibility --
-- a document type must explicitly opt in (unlike Controlled Copy, which has no per-type gate).
ALTER TABLE document_types ADD COLUMN allow_uncontrolled_copy boolean NOT NULL DEFAULT false;
