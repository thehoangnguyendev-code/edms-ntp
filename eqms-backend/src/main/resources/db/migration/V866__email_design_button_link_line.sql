-- Whether an e-mail writes the address of its button under it, for a reader whose mail program does not show the button.
alter table email_design add column show_button_link boolean not null default true;
