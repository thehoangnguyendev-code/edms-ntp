<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **edms-ntp** (30054 symbols, 80459 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/edms-ntp/context` | Codebase overview, check index freshness |
| `gitnexus://repo/edms-ntp/clusters` | All functional areas |
| `gitnexus://repo/edms-ntp/processes` | All execution flows |
| `gitnexus://repo/edms-ntp/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

# EQMS validation and regulated-workflow guardrails

For work affecting Document Control, Controlled Copies, workflow/lifecycle status,
authorization/object scope, electronic signatures, audit trails, file storage/MinIO,
Microsoft Graph/Office Online, async jobs, policies, or validation evidence:

- Read `.claude/skills/eqms-validation-engineering/SKILL.md` before making a finding,
  requirement claim, or source change.
- Treat `eqms-backend/docs/system/` as source-backed **As-Is** evidence only. Do not call an
  implemented behaviour GMP-compliant and do not turn it into a To-Be rule without a named,
  approved decision in `eqms-backend/docs/governance/DECISION_LOG.md`.
- Before implementation, state the invariant for actor/permission/object scope, lifecycle,
  parent-child effect, artefact version/checksum, audit/e-signature, and async generation where
  applicable. If a required business rule is not approved, stop and request the decision rather
  than inventing it.
- A request to audit, document, plan, or explain is read-only. Do not make source-code changes
  unless the user explicitly asks to implement a defined change.
- For a regulated implementation, link the work to one record based on
  `eqms-backend/docs/validation/08_ONE_CHANGE_RECORD_TEMPLATE.md`, then update its source/test
  evidence before handoff. A passing build alone is not validation evidence.
