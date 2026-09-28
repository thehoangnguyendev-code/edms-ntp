# 01 — System Overview (AS-IS)

## Purpose of this document set
This SDS describes what the current source code in `d:\edms-project` actually implements — not what the Quality Forward (QF) reference FRS/SDS describe as intended behavior. QF documents (`QF-DMS-FRS-V01-draft07.md`, `QF-DMS-SDS-V01-draft07.md`) are used only to identify terminology, expected workflow shapes, and candidate business rules to verify against code. Every non-trivial claim in this SDS is classified as one of:

`QF-MATCH` | `QF-DEVIATION` | `IMPLEMENTATION-DISCOVERED` | `IMPLEMENTATION-GAP` | `QF-INTERNAL-CONFLICT` | `UNKNOWN`

## System identity
- Custom-built eDMS/eQMS (Java Spring Boot backend + React frontend), developed with heavy conceptual reference to Quality Forward's Document Management module, but is an independent codebase — NOT a ServiceNow/QF deployment. Sections of the QF SDS describing ServiceNow-native platform features (native RBAC via ServiceNow groups, ServiceNow audit-attribute auto-capture, ServiceNow backup/replication, sys_user table) do not apply to this system and must not be assumed present; this system implements its own authorization, audit, and workflow subsystems in Java (see `02-architecture.md`, `06-role-authorization-model.md`).
- Estimated completion: ~60–70% per task brief (project-external claim, not verified from code in this pass).

## Scope of this SDS
Priority order (per task instructions), reflected in the depth of coverage across passes:
1. Document, Document Revision, Controlled Copy lifecycles (state machines, cascade-obsolete behavior, concurrency).
2. Distribution, Publishing, Review/Approval, Effective/Obsolete transitions.
3. Supporting subsystems: authorization, audit, e-signature, notifications, async/scheduled jobs, file storage/external integration.

## How to read this SDS
Each `NN-*.md` file is self-contained and cites source evidence as `Class.method()`, entity/table name, or endpoint rather than line numbers (which drift). Cross-file references use relative links. `21-known-unknowns-conflicts.md` is the running ledger of everything not yet determinable from code — consult it before treating any absence-of-evidence in another file as a confirmed negative.

## Status of this pass
See `AS-IS-SDS.md` (master index) for current coverage status; this is a living document set built incrementally per the task's "discover → document → continue" method, not completed in a single pass.
