-- Phase 1 of PERMISSION_DEPENDENCY_MATRIX_REVIEW_DRAFT.md: Permission Catalog-level dependency
-- data model only. Deliberately NOT wired into PermissionSetService/Access Profile save paths --
-- that enforcement is Phase 2, explicitly deferred until the Access Profile model is stable (see
-- the draft's Section 4 "Giai đoạn 2"). This table exists purely as the confirmed/proposed
-- REQUIRES/IMPLIES/NO_DEPENDENCY_JUSTIFIED reference data for the permission catalog, traceable
-- back to the draft's rule IDs (e.g. "DOC-02").
--
-- Only rows whose Section 3 status is a plain "ĐỀ XUẤT"/"ĐỀ XUẤT NGHIỆP VỤ" with no "cần trace"/
-- "route/API trace" hedge are seeded here (explicit product decision, 2026-08-26) -- e.g. SEC-02..13
-- ("ĐỀ XUẤT; cần route/API trace") are excluded pending that trace. DOC-08/DOC-09's IMPLIES edges
-- (review→reject_review, approve→reject_approval) are also excluded: those require a separate
-- Decision Log before they can be treated as approved (Section 6) -- only their REQUIRES edges are
-- seeded here.
CREATE TABLE permission_dependencies (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_code  VARCHAR(80)  NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
    -- NULL only for relation_type = 'NO_DEPENDENCY_JUSTIFIED' (a declaration that permission_code
    -- intentionally has no dependency, not an edge to another permission).
    depends_on_code  VARCHAR(80)  REFERENCES permissions(code) ON DELETE RESTRICT,
    relation_type    VARCHAR(30)  NOT NULL
        CHECK (relation_type IN ('REQUIRES', 'IMPLIES', 'NO_DEPENDENCY_JUSTIFIED')),
    -- PROPOSED: accepted as the Phase 1 design baseline from the review draft, not yet re-verified
    -- against live source code with the same rigor as the Section 1 "đã xác nhận" facts.
    -- CONFIRMED: independently re-verified against source (repository/service/policy) evidence.
    -- APPROVED_BUSINESS_DECISION: backed by a named Decision Log record (capability-widening
    -- IMPLIES rules only, per Section 4 Giai đoạn 1 item 5).
    status           VARCHAR(30)  NOT NULL DEFAULT 'PROPOSED'
        CHECK (status IN ('PROPOSED', 'CONFIRMED', 'APPROVED_BUSINESS_DECISION')),
    rule_id          VARCHAR(20)  NOT NULL,
    rationale        VARCHAR(500),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (permission_code <> depends_on_code),
    CHECK (
        (relation_type = 'NO_DEPENDENCY_JUSTIFIED' AND depends_on_code IS NULL)
        OR (relation_type <> 'NO_DEPENDENCY_JUSTIFIED' AND depends_on_code IS NOT NULL)
    )
);

CREATE UNIQUE INDEX ux_permission_dependencies_edge
    ON permission_dependencies (permission_code, depends_on_code, relation_type)
    WHERE depends_on_code IS NOT NULL;

CREATE UNIQUE INDEX ux_permission_dependencies_no_dependency
    ON permission_dependencies (permission_code)
    WHERE relation_type = 'NO_DEPENDENCY_JUSTIFIED';

CREATE INDEX idx_permission_dependencies_permission_code ON permission_dependencies (permission_code);
CREATE INDEX idx_permission_dependencies_depends_on_code ON permission_dependencies (depends_on_code);

INSERT INTO permission_dependencies (permission_code, depends_on_code, relation_type, rule_id, rationale) VALUES
    ('documents.document.view', 'documents.module.view', 'REQUIRES', 'DOC-02', 'Xem record cần vào module trước.'),

    ('documents.document.view_all', 'documents.module.view', 'REQUIRES', 'DOC-03', 'Quyền xem rộng cũng cần vào module.'),
    ('documents.document.view_all', 'documents.document.view', 'IMPLIES', 'DOC-03', 'Quyền xem rộng bao hàm xem cơ bản.'),

    ('documents.revision.review', 'documents.module.view', 'REQUIRES', 'DOC-08', 'Reviewer cần vào module trước khi thao tác review.'),
    ('documents.revision.review', 'documents.document.view', 'REQUIRES', 'DOC-08', 'Reviewer cần xem được record trước khi review.'),
    ('documents.revision.reject_review', 'documents.module.view', 'REQUIRES', 'DOC-08', 'Reviewer cần vào module trước khi thao tác reject review.'),
    ('documents.revision.reject_review', 'documents.document.view', 'REQUIRES', 'DOC-08', 'Reviewer cần xem được record trước khi reject review.'),

    ('documents.revision.approve', 'documents.module.view', 'REQUIRES', 'DOC-09', 'Approver cần vào module trước khi thao tác approve.'),
    ('documents.revision.approve', 'documents.document.view', 'REQUIRES', 'DOC-09', 'Approver cần xem được record trước khi approve.'),
    ('documents.revision.reject_approval', 'documents.module.view', 'REQUIRES', 'DOC-09', 'Approver cần vào module trước khi thao tác reject approval.'),
    ('documents.revision.reject_approval', 'documents.document.view', 'REQUIRES', 'DOC-09', 'Approver cần xem được record trước khi reject approval.'),

    ('documents.revision.force_publish', 'documents.revision.publish', 'REQUIRES', 'DOC-10', 'Ngoại lệ GMP force publish phải đi kèm quyền publish gốc, không cấp độc lập.'),

    ('documents.controlled_copy.receive_as_dco', NULL, 'NO_DEPENDENCY_JUSTIFIED', 'DOC-12', 'Eligibility người nhận Controlled Copy với vai trò DCO, không phải điều hướng UI.'),

    ('settings.dictionary.manage', 'settings.dictionary.view', 'REQUIRES', 'SET-01/02', 'Quản lý dictionary cần xem được dictionary.'),
    ('settings.controlled_copy_policy.manage', 'settings.controlled_copy_policy.view', 'REQUIRES', 'SET-03/04', 'Quản lý policy cần xem được policy cùng resource.'),
    ('settings.publishing_template.manage', 'settings.publishing_template.view', 'REQUIRES', 'SET-05/06', 'Quản lý publishing template cần xem được template cùng resource.'),
    ('settings.configuration.edit', 'settings.configuration.view', 'REQUIRES', 'SET-07/08', 'Sửa cấu hình cần xem được cấu hình trước.'),
    ('settings.notification_policy.manage', 'settings.notification_policy.view', 'REQUIRES', 'SET-09', 'Quản lý notification policy cần xem được policy trước.'),

    ('dashboard.admin.view', 'dashboard.module.view', 'REQUIRES', 'DSH-01/02', 'Dashboard admin view cần vào dashboard module trước.'),

    ('notifications.module.view', NULL, 'NO_DEPENDENCY_JUSTIFIED', 'NOT-01', 'Entry point module, không phụ thuộc permission khác.'),
    ('notifications.recipient.qa_manager', NULL, 'NO_DEPENDENCY_JUSTIFIED', 'NOT-02', 'Recipient eligibility, không phải điều hướng module.'),

    ('preferences.module.edit', 'preferences.module.view', 'REQUIRES', 'PRF-01/02', 'Sửa preferences cần xem được preferences trước.'),

    ('security.maintenance.bypass', NULL, 'NO_DEPENDENCY_JUSTIFIED', 'SEC-01', 'Ngoại lệ độc lập, không phụ thuộc permission khác.'),

    ('settings.user.create', 'settings.user.view', 'REQUIRES', 'USR-03/04', 'Thao tác User Management cần xem được danh sách user trước.'),
    ('settings.user.edit', 'settings.user.view', 'REQUIRES', 'USR-03/04', 'Thao tác User Management cần xem được danh sách user trước.'),
    ('settings.user.delete', 'settings.user.view', 'REQUIRES', 'USR-03/04', 'Thao tác User Management cần xem được danh sách user trước.'),
    ('settings.user.reset_password', 'settings.user.view', 'REQUIRES', 'USR-03/04', 'Thao tác User Management cần xem được danh sách user trước.'),
    ('settings.user.force_logout', 'settings.user.view', 'REQUIRES', 'USR-03/04', 'Thao tác User Management cần xem được danh sách user trước.'),

    ('training.material.manage', 'training.module.view', 'REQUIRES', 'TRN-01/02', 'Quản lý training material cần vào training module trước.'),
    ('training.session.manage', 'training.module.view', 'REQUIRES', 'TRN-01/02', 'Quản lý training session cần vào training module trước.'),
    ('training.assignment.manage', 'training.module.view', 'REQUIRES', 'TRN-01/02', 'Quản lý training assignment cần vào training module trước.');
