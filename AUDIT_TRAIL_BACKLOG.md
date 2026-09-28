# Audit Trail Coverage Backlog

Scope: full EQMS backend.  
Goal: every meaningful business, security, and configuration action must be traceable for GMP inspection.

## Current Coverage Status

### Already covered
- Authentication and session events
- System configuration changes
- User and role management
- Document and revision lifecycle
- Document cancel flow
- Revision workflow history
- Basic audit list/detail/export APIs

### In progress / partially covered
- Dictionary management
- Prompt specification generation workflow

## Priority 1: Complete business modules with highest GMP impact

### Document Administration Dictionary
File: `eqms-backend/src/main/java/com/eqms/service/DictionaryManagementService.java`

Actions to log:
- Business Unit create/update/delete
- Department create/update/delete
- Position create/update/delete
- Document Type create/update/delete
- Storage Location create/update/delete
- Retention Policy create/update/delete

Audit rules:
- Module: `Settings`
- Entity: display name of the dictionary record
- Description: short summary of the changed attributes
- Severity: `High` for create/update/delete

### Prompt Specification / Prompt Generation
File: `eqms-backend/src/main/java/com/eqms/service/PromptSpecificationService.java`

Actions to log:
- Prompt specification create/update/delete
- Prompt generation run create/update/status change
- Generated artifact creation

Audit rules:
- Module: `System` or `Settings` depending on UI placement
- Entity: prompt title or module name
- Description: what changed or what was generated

## Priority 2: Harden failure logging

Actions to log:
- Validation failures for business operations
- Permission denied events
- Session lock / reauth failure
- File upload or conversion failures

Rules:
- Even when the business transaction fails, write an audit record if the failure is meaningful to compliance.
- Use a safe helper to avoid breaking the primary transaction when the audit sink is temporarily unavailable.

## Priority 3: Standardize action naming

Recommended action taxonomy:
- `Create`
- `Update`
- `Delete`
- `Submit`
- `Review`
- `Approve`
- `Publish`
- `Upgrade`
- `Cancel`
- `Obsolete`
- `Login`
- `Logout`
- `Lock`
- `Reauthenticate`
- `Export`
- `Download`
- `Upload`

## Priority 4: Wire service methods to helper

For each service method that mutates state:
- resolve human-readable entity name
- resolve old/new values when available
- call `AuditTrailService.logAs(...)` or `logSafely(...)`
- include field changes if the action modifies multiple attributes

## Priority 5: Verification checklist

For every new audited action:
- verify record appears in `audit_logs`
- verify `entity_name` is human-readable
- verify `description` shows reason/comment if provided
- verify `changes` render in detail view when available
- verify list filter/search/export can find the record

