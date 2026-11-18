-- V802: Segregation of Duties constraints for the modules that were added after the first catalogue (owner decision 2026-11-18, SOD-NEW-MODULES).
--
-- Until now the only rules were for Document Control (V38, V152, V502) and the user/role pair. These are the pairs of permissions that one person must not hold together in
-- Training, Reports, Backup and Access Profile administration. Severity follows the risk: BLOCK where the pair lets a person approve or verify their own work (the system
-- refuses to give them both), WARN where the pair is a weakness that a small team may accept for a while (it shows in the SoD scan and in Access Review).
--
-- Every row is a system constraint, as V502: its pair, severity and reference are fixed and it cannot be deleted; an administrator may switch it off or on in Segregation of Duties
-- (that change is e-signed and audited). Each row is added only when the pair is not there yet, in either order, so a pair that an administrator already created by hand is left as it is.
--
-- Not seeded on purpose: Backup restore request against restore approval. The owner decided (Decision Log, BACKUP-RESTORE-SIMPLIFIED-2026-11-09) that restore approval is on paper and the software does not
-- carry a request / approve flow for it, so a rule over those two permissions would govern a step that does not exist.

INSERT INTO sod_constraints (name, description, permission_code_a, permission_code_b, severity, regulation_ref, active, system)
SELECT v.name, v.description, v.a, v.b, v.severity, v.ref, true, true
FROM (VALUES
    ('Transcribe vs Verify Paper Training Record',
     'The person who transcribes a paper training record into the system must not be the person who verifies it. Verification is the second pair of eyes on the transcription.',
     'training.paper.transcribe', 'training.paper.verify', 'BLOCK',
     'EU-GMP Annex 11 §12.1 · PIC/S PI 041 (second-person verification of manually entered data) · 21 CFR Part 11 §11.10(g)'),
    ('Record vs Approve Training Assessment',
     'The person who records the result of a training assessment must not approve the same assessment.',
     'training.assessment.record', 'training.assessment.approve', 'BLOCK',
     'EU-GMP Chapter 2 (Personnel) · EU-GMP Annex 11 §12.1 · 21 CFR Part 11 §11.10(g)'),
    ('Manage vs Approve Training Matrix',
     'The person who builds or changes a training matrix must not approve it.',
     'training.matrix.manage', 'training.matrix.approve', 'BLOCK',
     'EU-GMP Chapter 2 (Personnel) · EU-GMP Annex 11 §12.1 · 21 CFR Part 11 §11.10(g)'),
    ('Prepare vs Approve Training Requirement',
     'The person who prepares a training requirement must not approve it.',
     'training.requirement.prepare', 'training.requirement.approve', 'BLOCK',
     'EU-GMP Chapter 2 (Personnel) · EU-GMP Annex 11 §12.1 · 21 CFR Part 11 §11.10(g)'),
    ('Assign vs Close Training Activity',
     'The person who assigns training should not also close the activity as completed. A small team may accept this for a while; it is shown in the SoD scan and in Access Review.',
     'training.assignment.manage', 'training.activity.close', 'WARN',
     'EU-GMP Chapter 2 (Personnel) · EU-GMP Annex 11 §12.1'),
    ('Review vs Approve Training Content',
     'The person who reviews training content should not also approve it.',
     'training.content.review', 'training.content.approve', 'WARN',
     'EU-GMP Chapter 4 (Documentation) · EU-GMP Annex 11 §12.1'),
    ('Manage vs Approve GMP Report Template',
     'The person who writes or changes a report template must not approve it as a GMP template. Only GMP templates need approval.',
     'reports.definition.manage', 'reports.definition.approve_gmp', 'BLOCK',
     'EU-GMP Annex 11 §4 (validation) · EU-GMP Annex 11 §12.1 · 21 CFR Part 11 §11.10(g)'),
    ('Propose vs Approve Backup Policy Change',
     'The person who proposes a change of the backup policy must not approve it. A policy version needs a second person.',
     'backup.admin.policy.propose', 'backup.admin.policy.approve', 'BLOCK',
     'EU-GMP Annex 11 §7.2 (back-ups) · EU-GMP Annex 11 §12.1 · 21 CFR Part 11 §11.10(g)'),
    ('Request vs Approve Backup Export',
     'The person who exports backup data must not approve the same export.',
     'backup.backup.export', 'backup.backup.export.approve', 'BLOCK',
     'EU-GMP Annex 11 §7.2 (back-ups) · EU-GMP Annex 11 §12.1 · 21 CFR Part 11 §11.10(g)'),
    ('Assign Access Profiles vs Decide Access Review',
     'The person who assigns access profiles should not also decide the periodic review of those assignments. The review is the check on the people who administer access.',
     'security.access_profiles.assign', 'security.access_review.manage', 'WARN',
     'EU-GMP Annex 11 §12.3 · 21 CFR Part 11 §11.10(d), (g) · PIC/S PI 041 (periodic review of user access)')
) AS v(name, description, a, b, severity, ref)
WHERE NOT EXISTS (
    SELECT 1 FROM sod_constraints s
    WHERE (s.permission_code_a = v.a AND s.permission_code_b = v.b)
       OR (s.permission_code_a = v.b AND s.permission_code_b = v.a)
);
