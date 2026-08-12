UPDATE document_revisions
SET revision_name = CASE
    WHEN title IS NULL OR trim(title) = '' THEN COALESCE(NULLIF(trim(version), ''), '0.0.1')
    ELSE trim(title) || '_' || COALESCE(NULLIF(trim(version), ''), '0.0.1')
END
WHERE revision_name IS NULL
   OR revision_name <> CASE
        WHEN title IS NULL OR trim(title) = '' THEN COALESCE(NULLIF(trim(version), ''), '0.0.1')
        ELSE trim(title) || '_' || COALESCE(NULLIF(trim(version), ''), '0.0.1')
   END;
