-- Stage 5 (Target Architecture): "Capability Catalog" — a thin, data-driven
-- business-language layer over the existing Access Profile engine, powering
-- the "Quick Access Assignment" screen. No module/role names are hardcoded in
-- FE/BE code — adding a capability for any module is a data insert here.
--
-- A Capability = 1 Access Profile, given a plain-language label, grouped by
-- module_key. Ticking a capability for a user = adding/removing that Access
-- Profile in user_access_profiles (the exact same mechanism already used
-- everywhere else in the system) — no new authorization concept, no new
-- permission model.

CREATE TABLE capability_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_key VARCHAR(80) NOT NULL,
    code VARCHAR(80) NOT NULL UNIQUE,
    display_label VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    access_profile_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 100,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_capability_catalog_module ON capability_catalog(module_key, display_order);

INSERT INTO capability_catalog (module_key, code, display_label, description, access_profile_id, display_order)
SELECT v.module_key, v.code, v.display_label, v.description, r.id, v.display_order
FROM (VALUES
    ('documents', 'DOCUMENT_CONTRIBUTOR', 'Soạn thảo / Duyệt / Phê duyệt tài liệu', 'Author, Co-Author, Reviewer, Approver — vai trò thực tế trên từng tài liệu do DCO gán participant.', 'AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY', 10),
    ('documents', 'DOCUMENT_DCO', 'Điều phối tài liệu (DCO)', 'Tạo tài liệu, submit, publish, quản lý Controlled Copy.', 'AP_UAT_DCO_QUALITY', 20),
    ('documents', 'DOCUMENT_VIEWER', 'Chỉ xem tài liệu', 'Xem/tải theo phạm vi phòng ban, không có hành động workflow.', 'AP_UAT_READER_QUALITY', 30),
    ('documents', 'CONTROLLED_COPY_RECIPIENT', 'Nhận bản sao kiểm soát', 'Xem/tải bản sao được cấp, báo mất/hỏng.', 'AP_UAT_CC_RECIPIENT_QUALITY', 40)
) AS v(module_key, code, display_label, description, access_profile_code, display_order)
JOIN roles r ON r.code = v.access_profile_code
WHERE NOT EXISTS (SELECT 1 FROM capability_catalog c WHERE c.code = v.code);
