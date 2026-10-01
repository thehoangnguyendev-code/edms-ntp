-- V516: Form / eForm Phase 2a fix -- OnlyOffice's "Forms" ribbon (to add new fillable fields) only
-- appears reliably for a DOCX-family file opened as documentType="word"; a PDF conversion does not
-- expose it. Both the eForm edit session's working file and the Form's saved fillable template now
-- need their own file name (and therefore extension) tracked, instead of assuming ".pdf".

ALTER TABLE eform_edit_sessions ADD COLUMN file_name VARCHAR(255);
ALTER TABLE form_settings ADD COLUMN fillable_template_file_name VARCHAR(255);
