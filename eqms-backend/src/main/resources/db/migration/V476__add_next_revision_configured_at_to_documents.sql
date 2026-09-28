-- Records when the DCO last saved "Edit Revision for Upgrade" (next-revision configuration) on a Document
-- Master. An Active document's Author may only Upload Revision after that save; the marker is cleared as
-- soon as the upload creates the revision, so every upgrade cycle needs its own configuration.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS next_revision_configured_at TIMESTAMP WITH TIME ZONE;
