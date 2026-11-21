# Installation runbook — first sign-in of a new installation

Status: **proposed procedure, chosen by the owner on 2026-11-21 (option (a) of the PENDING_DECISION in
`docs/governance/DECISION_LOG.md`, section SECURITY-AUTHORIZATION-COMPLETION-2026-11-21).**
It is a controlled manual step. It is not approved by QA until the signature block below is signed for a
real installation. Option (b), a one-time bootstrap setting read from the environment, stays the
recommended change for a later release (DEC-AUTHZ-2026-11-21-05, "Not decided").

## Why this step exists

A new database starts with the second factor on (`security_config.enable2FA = true`), an e-mail
setting that points at a placeholder SMTP server, and the built-in `admin` with the e-mail
`admin@example.com`. The second factor is a code sent by e-mail, so the first administrator stops at
"Verify Your Identity" and cannot reach Configuration to fix the SMTP. The e-mail settings live only in
the database (`system_configurations.notifications_config.emailConfig`). The controls stay on: this
runbook gives the first administrator a working mailbox, it does not switch 2FA off.

## Before you start

- The application started on an empty database (Flyway reached the last migration, the log shows no error).
- You have: the real SMTP host, port, user, password, SSL setting, a sender address, and the
  administrator's real, personal e-mail address (one mailbox, one person: 21 CFR 11.300(a) unique identity).
- Two people take part: the **installer** (runs the SQL) and a **witness** (QA or IT Security) who
  checks the record afterwards.
- Do not paste the SMTP password into a ticket or chat. Type it only into the SQL session.

## Steps

1. **Record the state before.** Run and save the output in the installation record:

   ```sql
   select security_config->>'enable2FA' as two_factor,
          notifications_config->'emailConfig'->>'smtpHost' as smtp_host,
          notifications_config->'emailConfig'->>'senderEmail' as sender
     from system_configurations where config_key = 'default';
   select username, email, mfa_enabled, must_change_password, status from app_users where username = 'admin';
   ```

   Expected: `two_factor = true`, a placeholder `smtp_host`, `admin@example.com`, `must_change_password = t`.

2. **Set the e-mail server** (replace every `<...>`; keep `enable2FA` as it is):

   ```sql
   update system_configurations
      set notifications_config = jsonb_set(notifications_config, '{emailConfig}',
            jsonb_build_object('smtpHost', '<host>', 'smtpPort', <port>, 'useSSL', <true|false>,
                               'smtpUsername', '<user>', 'smtpPassword', '<password>',
                               'senderName', '<display name>', 'senderEmail', '<sender address>')),
          updated_at = now()
    where config_key = 'default';
   ```

3. **Set the administrator's real e-mail:**

   ```sql
   update app_users set email = '<real personal address>' where username = 'admin';
   ```

4. **Restart or wait** for the application to reload the e-mail setting (the mail sender is cached; a
   restart of the backend container is the sure way).

5. **First sign-in.** Open the application, sign in as `admin` with the initial password, enter the code
   that arrives by e-mail, and set the new password when asked (`must_change_password` forces it).
   The initial password is the one written in `AuthBootstrap`; it is already published in the source,
   so it must not survive the first sign-in.

6. **Confirm in the product** (Configuration > Notifications): send the built-in test e-mail, and check
   that the Audit Trail shows the first sign-in and the password change.

7. **Create the named administrators** through Users and Access Profiles (signed changes), then stop using
   the shared `admin` account for daily work. Keep it for break-glass use only, with the new password
   sealed under the site's procedure.

8. **Record the state after** (repeat the step 1 query; do not print the password) and sign below.

## What this runbook does not do

- It does not decide a one-time bootstrap setting from the environment (option (b)) or a break-glass
  local procedure (option (c)).
- The SMTP password is stored in the database by the existing design; where and how it is protected is
  outside this step.
- It was written from the source and the DEV database. It has **not** been run on a real new
  installation; the scratch-database test of 2026-11-21 reached the sign-in screen and stopped there.

## Installation record (copy per installation)

| Item | Value |
|---|---|
| Installation / environment | |
| Date and time (UTC+7) | |
| Installer (name, signature) | |
| Witness (name, signature) | |
| State before (step 1) attached | yes / no |
| State after (step 8) attached | yes / no |
| First sign-in and password change seen in the Audit Trail | yes / no |
| Deviations | |
