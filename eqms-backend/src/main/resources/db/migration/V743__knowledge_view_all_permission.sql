-- Owner decision 2026-11-04: the Knowledge Base has its own "view all", apart from Document Control. A person who audits the system (the DCO,
-- compliance) sees every Effective document in the Knowledge Base in every visibility mode, whatever a Head shared or excluded. Granted to no
-- profile by default: the administrator assigns it through an Access Profile. (permissions.description is VARCHAR(255): keep the text short.)
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT '72111111-1111-1111-1111-111111111743'::uuid, 'self_service.knowledge.view_all',
       'View All Documents in the Knowledge Base', 'Self-Service', 'self_service', 'self_service_access',
       'See every Effective document in the Knowledge Base, whatever a Head shared or excluded. Only the Knowledge Base: changes nothing in Document Control. Needs View Knowledge.',
       61, FALSE
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = 'self_service.knowledge.view_all');
