-- GMP retention guard: Document Masters, their Revisions and Controlled Copies
-- are lifecycle records. They must transition to a terminal business state,
-- never be physically removed (including by an accidental cascade delete).

CREATE OR REPLACE FUNCTION prevent_regulated_record_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Physical deletion is not permitted for regulated % records. Use an approved lifecycle transition instead.',
        TG_TABLE_NAME
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_prevent_delete ON documents;
CREATE TRIGGER trg_documents_prevent_delete
    BEFORE DELETE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION prevent_regulated_record_deletion();

DROP TRIGGER IF EXISTS trg_document_revisions_prevent_delete ON document_revisions;
CREATE TRIGGER trg_document_revisions_prevent_delete
    BEFORE DELETE ON document_revisions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_regulated_record_deletion();

DROP TRIGGER IF EXISTS trg_controlled_copies_prevent_delete ON controlled_copies;
CREATE TRIGGER trg_controlled_copies_prevent_delete
    BEFORE DELETE ON controlled_copies
    FOR EACH ROW
    EXECUTE FUNCTION prevent_regulated_record_deletion();
