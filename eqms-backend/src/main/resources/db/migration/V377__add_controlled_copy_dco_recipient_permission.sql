-- Per user requirement: no hardcoded "DCO" role/access-profile name may gate the DCO delivery
-- redirect feature (V376). Instead, a dedicated permission determines eligibility -- any user
-- holding it can be selected as the DCO recipient in Controlled Copies Policy, regardless of what
-- their access profile/role is named. Deliberately NOT auto-granted to any permission set here --
-- the Admin assigns it explicitly via the existing Access Profile / Permission Set screens.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES (
    gen_random_uuid(),
    'documents.controlled_copy.receive_as_dco',
    'Receive Controlled Copies as DCO',
    'Controlled Copy',
    'documents',
    'controlled_copy',
    'Eligible to be selected in Controlled Copies Policy as the DCO recipient who receives the printable file/ZIP instead of the original requester(s) when delivery redirection is enabled.',
    667,
    true
);
