-- V804: the meaning of the electronic signature on "Reset MFA" (owner decision 2026-11-18, SECURITY-AUTHORIZATION-REVIEW D4).
-- Seeded so an administrator can rename its display label, as for the other user actions (V382).
INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES (gen_random_uuid(), 'USER_MFA_RESET', 'User MFA Reset')
ON CONFLICT (code) DO NOTHING;
