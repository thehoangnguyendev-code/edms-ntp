-- REPORT-RUN-NUMBER-2026-11-15: every report run has a number a person can read and quote (RUN-000123); the UUID stays an internal key and is not printed in files or screens.
-- Runs that already exist are numbered in the order they were queued; new runs take the next number from the sequence.
alter table report_runs add column run_number bigint;

with numbered as (select id, row_number() over (order by queued_at, id) as n from report_runs)
update report_runs r set run_number = numbered.n from numbered where r.id = numbered.id;

create sequence report_run_number_seq;
select setval('report_run_number_seq', coalesce((select max(run_number) from report_runs), 0) + 1, false);
alter table report_runs alter column run_number set default nextval('report_run_number_seq');
alter sequence report_run_number_seq owned by report_runs.run_number;
alter table report_runs alter column run_number set not null;
alter table report_runs add constraint uq_report_runs_run_number unique (run_number);
