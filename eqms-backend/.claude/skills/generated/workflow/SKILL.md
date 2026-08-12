---
name: workflow
description: "Skill for the Workflow area of eqms-backend. 9 symbols across 2 files."
---

# Workflow

9 symbols | 2 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how all, allControlledCopy, allDocument work
- Modifying workflow-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/main/java/com/eqms/service/workflow/DocumentsWorkflowDefinitionProvider.java` | getWorkflowDefinitions, documentActions, revisionActions, controlledCopyActions, actionDefinition (+1) |
| `src/main/java/com/eqms/service/WorkflowActionDefaultPolicyRegistry.java` | all, allControlledCopy, allDocument |

## Entry Points

Start here when exploring this area:

- **`all`** (Method) — `src/main/java/com/eqms/service/WorkflowActionDefaultPolicyRegistry.java:205`
- **`allControlledCopy`** (Method) — `src/main/java/com/eqms/service/WorkflowActionDefaultPolicyRegistry.java:210`
- **`allDocument`** (Method) — `src/main/java/com/eqms/service/WorkflowActionDefaultPolicyRegistry.java:215`
- **`getWorkflowDefinitions`** (Method) — `src/main/java/com/eqms/service/workflow/DocumentsWorkflowDefinitionProvider.java:20`
- **`documentActions`** (Method) — `src/main/java/com/eqms/service/workflow/DocumentsWorkflowDefinitionProvider.java:38`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `all` | Method | `src/main/java/com/eqms/service/WorkflowActionDefaultPolicyRegistry.java` | 205 |
| `allControlledCopy` | Method | `src/main/java/com/eqms/service/WorkflowActionDefaultPolicyRegistry.java` | 210 |
| `allDocument` | Method | `src/main/java/com/eqms/service/WorkflowActionDefaultPolicyRegistry.java` | 215 |
| `getWorkflowDefinitions` | Method | `src/main/java/com/eqms/service/workflow/DocumentsWorkflowDefinitionProvider.java` | 20 |
| `documentActions` | Method | `src/main/java/com/eqms/service/workflow/DocumentsWorkflowDefinitionProvider.java` | 38 |
| `revisionActions` | Method | `src/main/java/com/eqms/service/workflow/DocumentsWorkflowDefinitionProvider.java` | 47 |
| `controlledCopyActions` | Method | `src/main/java/com/eqms/service/workflow/DocumentsWorkflowDefinitionProvider.java` | 76 |
| `actionDefinition` | Method | `src/main/java/com/eqms/service/workflow/DocumentsWorkflowDefinitionProvider.java` | 96 |
| `toLabel` | Method | `src/main/java/com/eqms/service/workflow/DocumentsWorkflowDefinitionProvider.java` | 112 |

## How to Explore

1. `context({name: "all"})` — see callers and callees
2. `query({search_query: "workflow"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
