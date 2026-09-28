# Audit Trail Standard

This document defines the global audit trail standard for EQMS.  
It applies to all modules, all server-side state changes, and all security-sensitive actions.

## 1. Implementation Checklist

### 1.1 Authentication and Session
- Log every login success and failure.
- Log logout, session lock, re-authentication success/failure, and revoked session events.
- Persist IP address, device, session id, correlation id, and actor information.
- Do not let front-end code write audit records directly.

### 1.2 System Configuration
- Log every configuration save with old/new values.
- Persist the changed-by user and timestamp.
- Use `Settings` as module and `System Configuration` as the entity.

### 1.3 Users, Roles, and Permissions
- Log create, update, disable, enable, password reset, and permission changes.
- Record the affected user/role name as the entity.
- Mark permission changes as high severity.

### 1.4 Documents and Revisions
- Log draft creation, save, upload revision, submit, review, approve, publish, upgrade, obsolete, and cancel.
- Keep document and revision names human-readable.
- Use server-side status transitions as the source of truth.

### 1.5 Files and Sharing
- Log upload, download, preview, conversion, share-link creation, and revocation.
- Log external sharing changes separately when applicable.

### 1.6 Reports and Export
- Log every export and download action for list/detail reports and audit records.

### 1.7 Failure Events
- Log validation errors, permission denied, business rule failures, and technical failures.
- If a request fails before entity resolution, still write an audit entry with a meaningful entity name such as `Authentication Session` or `System`.

## 2. Schema Standard

### 2.1 `audit_logs`

Core immutable audit header.

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID PK | Primary key |
| `entity_type` | VARCHAR(40) | Logical entity/module source |
| `entity_id` | UUID | Target entity id |
| `entity_name` | VARCHAR(255) | Human-readable entity name |
| `action_type` | VARCHAR(50) | Action code |
| `from_status` | VARCHAR(40) | Previous state |
| `to_status` | VARCHAR(40) | New state |
| `comment` | VARCHAR(1024) | Reason or description |
| `acted_by_user_id` | UUID FK | User who performed action |
| `ip_address` | VARCHAR(80) | Client IP |
| `device_browser` | VARCHAR(80) | Browser |
| `device_model` | VARCHAR(120) | Device model |
| `device_platform` | VARCHAR(80) | Platform |
| `device_platform_version` | VARCHAR(40) | Platform version |
| `device_name` | VARCHAR(255) | Human-readable device label |
| `created_at` | TIMESTAMPTZ | Created timestamp |
| `updated_at` | TIMESTAMPTZ | Updated timestamp |

### 2.2 `audit_log_changes`

Optional row-per-field change detail.

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID PK | Primary key |
| `audit_log_id` | UUID FK | Parent audit log |
| `field_name` | VARCHAR(120) | Changed field |
| `old_value` | TEXT | Old value |
| `new_value` | TEXT | New value |
| `change_order` | INTEGER | Display order |
| `created_at` | TIMESTAMPTZ | Created timestamp |
| `updated_at` | TIMESTAMPTZ | Updated timestamp |

## 3. Display Rules

- `Module`: keep the business module label, e.g. `Document`, `Revision`, `Settings`, `System`.
- `Action`: keep a concise verb, e.g. `Create`, `Update`, `Publish`, `Login`, `Logout`.
- `Entity`: always human-readable, never raw UUID.
- `Description`: short reason or summary.
- `Detail view`: show the full changes and metadata.

## 4. Backend Rule

- All audit events must be generated on the server.
- Front-end must only display, filter, search, and export audit data.
- For change-heavy operations, use `audit_log_changes` together with `audit_logs`.
- If audit write fails, the business transaction may continue only when the action is non-blocking and explicitly configured as best-effort.

## 5. Governance

- Any new module must define:
  - audit module name
  - action codes
  - entity naming convention
  - severity mapping
  - success/failure behavior
- Developers must update this standard when adding new business workflows.

