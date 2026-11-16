-- REPORT-NON-GMP-NO-APPROVAL-2026-11-15: a template that is not used for GMP decisions comes into force when it is saved, with no one's approval. The revision says so
-- (NOT_REQUIRED), so that nothing reads as approved that no one approved. Every revision that exists was approved by a person and stays APPROVED.
alter table report_template_revisions add column approval_basis varchar(20) not null default 'APPROVED';
alter table report_template_revisions add constraint ck_report_template_revisions_approval_basis check (approval_basis in ('APPROVED', 'NOT_REQUIRED'));
