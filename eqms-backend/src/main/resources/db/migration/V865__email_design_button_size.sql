-- How large the action button of an e-mail is. MEDIUM is the size every e-mail had before it could be chosen.
alter table email_design add column button_size varchar(10) not null default 'MEDIUM';
