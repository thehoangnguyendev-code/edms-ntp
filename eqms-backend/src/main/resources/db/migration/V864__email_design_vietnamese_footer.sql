-- The footer of an e-mail sent to a person who chose Vietnamese. Empty: the footer of the design is used.
alter table email_design add column footer_text_vi text;
update email_design set footer_text_vi = replace(footer_text, 'All rights reserved.', 'Bảo lưu mọi quyền.') where footer_text like '%All rights reserved.%';
