-- DATA-REPAIR-STATUS-CONSISTENCY-2026-11-14 (owner instruction: "sửa hết")
-- One-off repair of DEV data whose statuses contradict the lifecycle of the Document Master (never a Flyway migration: it must not run on any other database).
-- Rules the data must follow:
--   * a revision that ever was Effective (history says so, or a Controlled Copy was made from it) is Effective now or Obsoleted; it is never Closed - Cancelled;
--   * a Document is Active iff it has an Effective revision; else Obsoleted if it has an Obsoleted revision; else Draft if it has an open revision; else Closed - Cancelled;
--   * an Obsoleted Document has no open revision (they are cancelled);
--   * a live Controlled Copy (Ready for Distribution, Distributed) belongs to an Effective revision; otherwise it is Obsoleted;
--   * the label of a status is the label of its code.
-- History is never rewritten: every changed revision gets a DATA_CORRECTION row in revision_workflow_history that says what was changed and why.
-- Run:  docker exec -i eqms-postgres psql -U eqms -d eqms-database -v ON_ERROR_STOP=1 < DATA_REPAIR_STATUS_CONSISTENCY_2026_11_14.sql
BEGIN;

CREATE TEMP TABLE rev_before AS SELECT id, status_code FROM document_revisions;
CREATE TEMP TABLE doc_before AS SELECT id, status_code FROM documents;
CREATE TEMP TABLE cc_before AS SELECT id, status_code, status FROM controlled_copies;

-- 1. an Obsoleted Document has no open revision: cancel the open ones
CREATE TEMP TABLE open_under_obsoleted AS
SELECT r.id FROM document_revisions r JOIN documents d ON d.id = r.document_id
 WHERE d.status_code = 'OBSOLETED' AND r.status_code NOT IN ('OBSOLETED', 'CLOSED_CANCELLED', 'EFFECTIVE');
UPDATE document_revisions SET status_code = 'CLOSED_CANCELLED', cancelled_at = COALESCE(cancelled_at, now()), updated_at = now()
 WHERE id IN (SELECT id FROM open_under_obsoleted);
INSERT INTO revision_workflow_history (id, revision_id, action_type, from_status, to_status, comment, created_at, updated_at)
SELECT gen_random_uuid(), o.id, 'DATA_CORRECTION', b.status_code, 'CLOSED_CANCELLED',
       'Data correction 2026-11-14: the Document is Obsoleted, so it cannot have an open revision.', now(), now()
  FROM open_under_obsoleted o JOIN rev_before b ON b.id = o.id;

-- 2. a revision that was Effective is Obsoleted, never Closed - Cancelled
CREATE TEMP TABLE was_effective AS
SELECT r.id FROM document_revisions r
 WHERE r.status_code = 'CLOSED_CANCELLED'
   AND (EXISTS (SELECT 1 FROM revision_workflow_history h WHERE h.revision_id = r.id AND h.to_status = 'EFFECTIVE')
     OR EXISTS (SELECT 1 FROM controlled_copies c WHERE c.revision_id = r.id));
UPDATE document_revisions SET status_code = 'OBSOLETED', obsoleted_at = COALESCE(obsoleted_at, cancelled_at::timestamp, updated_at::timestamp), updated_at = now()
 WHERE id IN (SELECT id FROM was_effective);
INSERT INTO revision_workflow_history (id, revision_id, action_type, from_status, to_status, comment, created_at, updated_at)
SELECT gen_random_uuid(), w.id, 'DATA_CORRECTION', 'EFFECTIVE', 'OBSOLETED',
       'Data correction 2026-11-14: the revision was Effective (history or a Controlled Copy shows it) and had been recorded as Closed - Cancelled; its true path is Effective, then Obsoleted.', now(), now()
  FROM was_effective w;

-- 3. a revision that is Obsoleted without any record of it ever having been Effective keeps its status; the history says what the status means (it was Effective)
INSERT INTO revision_workflow_history (id, revision_id, action_type, from_status, to_status, comment, created_at, updated_at)
SELECT gen_random_uuid(), r.id, 'DATA_CORRECTION', 'EFFECTIVE', 'OBSOLETED',
       'Data correction 2026-11-14: the status was set outside the workflow and no history exists. A revision is Obsoleted only after being Effective, so its path is Effective, then Obsoleted.', now(), now()
  FROM document_revisions r
 WHERE r.status_code = 'OBSOLETED'
   AND NOT EXISTS (SELECT 1 FROM revision_workflow_history h WHERE h.revision_id = r.id AND (h.to_status = 'EFFECTIVE' OR h.action_type IN ('OBSOLETE', 'LEGACY_BATCH_SUPERSEDED', 'DATA_CORRECTION')))
   AND r.id NOT IN (SELECT id FROM was_effective);
UPDATE document_revisions SET obsoleted_at = COALESCE(obsoleted_at, updated_at::timestamp) WHERE status_code = 'OBSOLETED' AND obsoleted_at IS NULL;

-- 4. the status of each Document follows its revisions
WITH target AS (
  SELECT d.id,
         CASE WHEN bool_or(r.status_code = 'EFFECTIVE') THEN 'ACTIVE'
              WHEN bool_or(r.status_code = 'OBSOLETED') THEN 'OBSOLETED'
              WHEN bool_or(r.status_code NOT IN ('CLOSED_CANCELLED')) THEN 'DRAFT'
              ELSE 'CLOSED_CANCELLED' END AS wanted
    FROM documents d JOIN document_revisions r ON r.document_id = d.id GROUP BY d.id)
UPDATE documents d SET status_code = t.wanted,
       obsoleted_at = CASE WHEN t.wanted = 'OBSOLETED' THEN COALESCE(d.obsoleted_at, now()::timestamp) ELSE d.obsoleted_at END,
       updated_at = now()
  FROM target t WHERE t.id = d.id AND d.status_code <> t.wanted;

-- 5. a live Controlled Copy belongs to an Effective revision
UPDATE controlled_copies c SET status_code = 'OBSOLETED', status = 'Obsoleted', current_stage = 'Obsoleted',
       obsolete_reason = COALESCE(c.obsolete_reason, CASE WHEN d.status_code = 'OBSOLETED' THEN 'DOCUMENT_OBSOLETED' ELSE 'REVISION_OBSOLETED' END),
       obsoleted_at = COALESCE(c.obsoleted_at, now()), updated_at = now()
  FROM document_revisions r, documents d
 WHERE r.id = c.revision_id AND d.id = c.document_id AND c.status_code IN ('DISTRIBUTED', 'READY_FOR_DISTRIBUTION') AND r.status_code <> 'EFFECTIVE';

-- 6. the label of a status is the label of its code
UPDATE controlled_copies SET status = CASE status_code WHEN 'READY_FOR_DISTRIBUTION' THEN 'Ready for Distribution' WHEN 'DISTRIBUTED' THEN 'Distributed'
       WHEN 'OBSOLETED' THEN 'Obsoleted' WHEN 'CLOSED_CANCELLED' THEN 'Closed - Cancelled' END
 WHERE status <> CASE status_code WHEN 'READY_FOR_DISTRIBUTION' THEN 'Ready for Distribution' WHEN 'DISTRIBUTED' THEN 'Distributed'
       WHEN 'OBSOLETED' THEN 'Obsoleted' WHEN 'CLOSED_CANCELLED' THEN 'Closed - Cancelled' END;
UPDATE controlled_copy_distribution_batches SET status = CASE status_code WHEN 'READY_FOR_DISTRIBUTION' THEN 'Ready for Distribution' WHEN 'DISTRIBUTED' THEN 'Distributed'
       WHEN 'OBSOLETED' THEN 'Obsoleted' WHEN 'CLOSED_CANCELLED' THEN 'Closed - Cancelled' END
 WHERE status_code IN ('READY_FOR_DISTRIBUTION', 'DISTRIBUTED', 'OBSOLETED', 'CLOSED_CANCELLED')
   AND status <> CASE status_code WHEN 'READY_FOR_DISTRIBUTION' THEN 'Ready for Distribution' WHEN 'DISTRIBUTED' THEN 'Distributed'
       WHEN 'OBSOLETED' THEN 'Obsoleted' WHEN 'CLOSED_CANCELLED' THEN 'Closed - Cancelled' END;
-- the stage of a copy is written with the same words as its status
UPDATE controlled_copies SET current_stage = status WHERE current_stage IS DISTINCT FROM status;
-- a batch whose copies are all Obsoleted is Obsoleted
UPDATE controlled_copy_distribution_batches b SET status_code = 'OBSOLETED', status = 'Obsoleted', updated_at = now()
 WHERE b.status_code IN ('DISTRIBUTED', 'READY_FOR_DISTRIBUTION')
   AND EXISTS (SELECT 1 FROM controlled_copies c WHERE c.distribution_batch_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM controlled_copies c WHERE c.distribution_batch_id = b.id AND c.status_code <> 'OBSOLETED');

-- what was changed (for the evidence file)
SELECT 'revisions changed' AS what, count(*) FROM document_revisions r JOIN rev_before b ON b.id = r.id WHERE b.status_code <> r.status_code
UNION ALL SELECT 'documents changed', count(*) FROM documents d JOIN doc_before b ON b.id = d.id WHERE b.status_code <> d.status_code
UNION ALL SELECT 'controlled copies changed (status)', count(*) FROM controlled_copies c JOIN cc_before b ON b.id = c.id WHERE b.status_code <> c.status_code
UNION ALL SELECT 'controlled copies changed (label only)', count(*) FROM controlled_copies c JOIN cc_before b ON b.id = c.id WHERE b.status_code = c.status_code AND b.status <> c.status;

-- the checks: every one must be 0
SELECT 'doc Closed-Cancelled with an effective/obsoleted revision' AS check_name, count(DISTINCT d.id) FROM documents d JOIN document_revisions r ON r.document_id = d.id WHERE d.status_code = 'CLOSED_CANCELLED' AND r.status_code IN ('EFFECTIVE', 'OBSOLETED')
UNION ALL SELECT 'doc Obsoleted with an open revision', count(DISTINCT d.id) FROM documents d JOIN document_revisions r ON r.document_id = d.id WHERE d.status_code = 'OBSOLETED' AND r.status_code NOT IN ('OBSOLETED', 'CLOSED_CANCELLED')
UNION ALL SELECT 'doc Active without an effective revision', count(*) FROM documents d WHERE d.status_code = 'ACTIVE' AND NOT EXISTS (SELECT 1 FROM document_revisions r WHERE r.document_id = d.id AND r.status_code = 'EFFECTIVE')
UNION ALL SELECT 'doc Active with 2+ effective revisions', count(*) FROM (SELECT d.id FROM documents d JOIN document_revisions r ON r.document_id = d.id WHERE r.status_code = 'EFFECTIVE' GROUP BY d.id HAVING count(*) > 1) x
UNION ALL SELECT 'effective revision under a doc that is not Active', count(*) FROM document_revisions r JOIN documents d ON d.id = r.document_id WHERE r.status_code = 'EFFECTIVE' AND d.status_code <> 'ACTIVE'
UNION ALL SELECT 'cancelled revision that was effective', count(*) FROM document_revisions r WHERE r.status_code = 'CLOSED_CANCELLED' AND (EXISTS (SELECT 1 FROM revision_workflow_history h WHERE h.revision_id = r.id AND h.to_status = 'EFFECTIVE' AND h.action_type <> 'DATA_CORRECTION') OR EXISTS (SELECT 1 FROM controlled_copies c WHERE c.revision_id = r.id))
UNION ALL SELECT 'live controlled copy on a non-effective revision', count(*) FROM controlled_copies c JOIN document_revisions r ON r.id = c.revision_id WHERE c.status_code IN ('DISTRIBUTED', 'READY_FOR_DISTRIBUTION') AND r.status_code <> 'EFFECTIVE'
UNION ALL SELECT 'controlled copy label differs from its code', count(*) FROM controlled_copies WHERE status <> CASE status_code WHEN 'READY_FOR_DISTRIBUTION' THEN 'Ready for Distribution' WHEN 'DISTRIBUTED' THEN 'Distributed' WHEN 'OBSOLETED' THEN 'Obsoleted' WHEN 'CLOSED_CANCELLED' THEN 'Closed - Cancelled' END
UNION ALL SELECT 'obsoleted revision without obsoleted_at', count(*) FROM document_revisions WHERE status_code = 'OBSOLETED' AND obsoleted_at IS NULL;

COMMIT;
