-- Owner decision DEC-TRAINING-2026-11-23-12 (C1): the organizer chooses the two approvers of the training content freely, but the Select Approver window shows a notice when the choice is not the head
-- of the unit concerned and the Quality Manager, as SOP.0003 5.3.5 and its flow chart expect. The Quality Manager is recognised by this permission (nobody holds it until an administrator gives it).
-- Forward-only and idempotent. Rollback (if needed): delete the permission after taking it from the permission sets that hold it.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'training.quality_manager', 'Is the Quality Manager of Training',
     'Training Management', 'training', 'training_activity',
     'Marks the person as the Quality Manager who, with the head of the unit concerned, approves training content (SOP.0003 5.3.5). It only labels the person; approving needs the permission to approve training content.', 242, FALSE)
ON CONFLICT (code) DO NOTHING;
