-- REPORT-TEMPLATE-REJECT-NOTICE-2026-11-15 (owner): the button that returned a revision to Draft is now Reject. The meaning of the electronic signature that goes with it reads the same way.
-- Only the words shown to people change; the code REPORT_TEMPLATE_REJECTION is the machine value and does not change. Idempotent.
UPDATE electronic_signature_meanings
   SET display_name = 'Report Template Rejected'
 WHERE code = 'REPORT_TEMPLATE_REJECTION' AND display_name = 'Report Template Returned to Draft';
