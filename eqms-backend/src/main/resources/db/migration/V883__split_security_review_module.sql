-- "Access Review & Audit Trail Review" was one module key (SECURITY_REVIEW) over two menus. A module is a level-1 menu: Access Review belongs to
-- Security & Authorization (SECURITY), Audit Trail Review to Audit Trail (AUDIT_TRAIL). Only the module key of the rows changes; the policies, their
-- relations and the rules that are switched on keep their ids and their state.
UPDATE workflow_action_policies SET module_key = 'SECURITY' WHERE module_key = 'SECURITY_REVIEW' AND object_type = 'ACCESS_REVIEW_CAMPAIGN';
UPDATE workflow_action_policies SET module_key = 'AUDIT_TRAIL' WHERE module_key = 'SECURITY_REVIEW' AND object_type = 'AUDIT_REVIEW_CAMPAIGN';
UPDATE separation_rule_catalog SET module_key = 'SECURITY' WHERE module_key = 'SECURITY_REVIEW' AND object_type = 'ACCESS_REVIEW_CAMPAIGN';
UPDATE separation_rule_catalog SET module_key = 'AUDIT_TRAIL' WHERE module_key = 'SECURITY_REVIEW' AND object_type = 'AUDIT_REVIEW_CAMPAIGN';
