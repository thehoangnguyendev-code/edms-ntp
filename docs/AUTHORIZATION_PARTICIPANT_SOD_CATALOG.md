# Participant and Segregation of Duties Catalog

This catalog is the BA/QA/Compliance approval reference for participant eligibility
and segregation of duties (SoD) in live authorization modules. It complements the
[Global Action Catalog](AUTHORIZATION_GLOBAL_ACTION_CATALOG.md). A new participant
type, relationship, or exception must be approved here before it is implemented.

## Common rules

* An Access Profile establishes enduring capability only; it never assigns a person
  to a particular record.
* A participant assignment is record-scoped and is authoritative for actor rules.
* Eligible-user queries must validate active account, required permission, workflow
  role eligibility, object scope and every applicable SoD rule server-side.
* Assignment changes are auditable. Revision participant rows remain the source of
  truth until the generic-participant reconciliation gate has passed.
* `SYSTEM_SUPER_ADMIN` does not bypass participant assignment or SoD.

## Documents / Document Revision

| Participant type | Assignment owner | Eligibility | May act at | SoD / exclusion |
|---|---|---|---|---|
| Author | Document owner or DCO, at draft creation | Active user with author capability and document scope | Draft authoring and submission | Cannot review or approve the same revision. |
| Co-author | Author or DCO while draft is editable | Active user with co-author capability and document scope | Draft editing only | Cannot review or approve the same revision. |
| Reviewer | DCO/authorized workflow configurator | Active user with review capability, workflow eligibility and scope | `PENDING_REVIEW` | Cannot be Author, Co-author or DCO actor for the same revision; configured department separation applies. |
| Approver | DCO/authorized workflow configurator | Active user with approval capability, workflow eligibility and scope | `PENDING_APPROVAL` | Cannot be Author, Co-author or Reviewer for the same revision; configured department separation applies. |
| Training coordinator | Workflow configuration | Active user with training-stage capability and scope | Document-training stage | Must satisfy configured training separation rule. |
| DCO / Document Admin | Access Profile and policy actor, not a generic participant assignment | Active user with policy permission and document scope | Policy-defined DCO actions | May not impersonate an assigned Reviewer or Approver. |

## Controlled Copies

| Actor | Source of assignment | Eligibility | SoD / exclusion |
|---|---|---|---|
| Requester | Controlled-copy request | Active user with request permission and source-document scope | Cannot approve their own request unless an approved policy explicitly permits it. |
| Recipient / custodian | Controlled-copy record | Active user assigned as copy holder | May preview/download/report loss only within lifecycle policy. |
| Batch approver | Controlled-copy workflow policy | Active user with approval permission and source-document scope | Must not be requester for a self-approved request. |
| Distributor / DCO | Controlled-copy workflow policy | Active user with distribution permission and source-document scope | May execute only policy-defined lifecycle transitions. |

## Work Management

| Actor | Source of assignment | Eligibility | SoD / exclusion |
|---|---|---|---|
| Project admin | `work_project_members` | Active user, Work Management entitlement and project-admin membership | May manage members; membership remains record-level, not an Access Profile. |
| Member | `work_project_members` | Active user, Work Management entitlement and member membership | May create/update issues when project is active. |
| Viewer | `work_project_members` | Active user, Work Management entitlement and viewer membership | Read only; cannot create/update issues or manage members. |

## Exception process

No UI or API may silently bypass a row above. A business exception requires an
approved policy change, documented reason, e-signature where the security change
requires it, and a composite audit event. The exception must be added to this
catalog before it can be enabled in a migrated action.
