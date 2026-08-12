CREATE TABLE IF NOT EXISTS controlled_copy_policy_settings (
    id                                      UUID        NOT NULL PRIMARY KEY,

    -- General
    default_distribution_method             VARCHAR(20) NOT NULL DEFAULT 'HYBRID',

    -- Approval
    require_approval                        BOOLEAN     NOT NULL DEFAULT TRUE,
    approver_role                           VARCHAR(50) NOT NULL DEFAULT 'QA_MANAGER',
    approver_user                           VARCHAR(255),

    -- Expiry
    default_expiry_policy                   VARCHAR(30) NOT NULL DEFAULT 'NEVER_EXPIRE',
    requester_may_override                  BOOLEAN     NOT NULL DEFAULT TRUE,
    expiry_required                         BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Distribution & Security
    allow_email_distribution                BOOLEAN     NOT NULL DEFAULT TRUE,
    allow_portal_view                       BOOLEAN     NOT NULL DEFAULT TRUE,
    allow_download                          BOOLEAN     NOT NULL DEFAULT FALSE,
    allow_print                             BOOLEAN     NOT NULL DEFAULT FALSE,
    view_only_mode                          BOOLEAN     NOT NULL DEFAULT TRUE,
    watermark_enabled                       BOOLEAN     NOT NULL DEFAULT TRUE,
    watermark_copy_number                   BOOLEAN     NOT NULL DEFAULT TRUE,
    watermark_recipient                     BOOLEAN     NOT NULL DEFAULT TRUE,
    watermark_distributed_date              BOOLEAN     NOT NULL DEFAULT TRUE,
    watermark_expiry_date                   BOOLEAN     NOT NULL DEFAULT TRUE,

    -- Recall / Lost / Damaged
    auto_recall_when_new_revision_effective BOOLEAN     NOT NULL DEFAULT TRUE,
    auto_recall_when_revision_obsoleted     BOOLEAN     NOT NULL DEFAULT TRUE,
    allow_manual_recall                     BOOLEAN     NOT NULL DEFAULT TRUE,
    allow_report_lost                       BOOLEAN     NOT NULL DEFAULT TRUE,
    allow_report_damaged                    BOOLEAN     NOT NULL DEFAULT TRUE,
    allow_replacement_for_lost_damaged      BOOLEAN     NOT NULL DEFAULT TRUE,

    created_at                              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the single-row default
INSERT INTO controlled_copy_policy_settings (id)
VALUES ('00000000-0000-0000-0000-000000000201')
ON CONFLICT (id) DO NOTHING;
