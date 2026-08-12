-- V231 seeded user.g/h/i/j.test with a bcrypt hash that does not actually match the
-- documented UAT test password (Test@12345, same convention as user.a-f.test from V179),
-- causing login failures for these accounts. This corrects the hash to a value generated
-- with the app's own BCryptPasswordEncoder for "Test@12345".

UPDATE app_users
SET password_hash = '$2a$10$9s2P4dud9lQ9ChxXq3cXzOmXE2KH.EyMajWdaeOpZR33HA9ehXLh2'
WHERE username IN ('user.g.test', 'user.h.test', 'user.i.test', 'user.j.test');
