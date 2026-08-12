INSERT INTO electronic_signature_meanings (id, code, display_name, description, requires_reason, requires_comment, active, sort_order)
VALUES
    ('00000000-0000-0000-0000-000000139001', 'SUBMITTED_FOR_REVIEW', 'Submitted For Review', 'User confirms the revision was submitted for review.', TRUE, FALSE, TRUE, 15)
ON CONFLICT (code) DO NOTHING;
