<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **eqms-backend** (11100 symbols, 35767 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
| `gitnexus://repo/eqms-backend/context` | Codebase overview, check index freshness |
| `gitnexus://repo/eqms-backend/clusters` | All functional areas |
| `gitnexus://repo/eqms-backend/processes` | All execution flows |
| `gitnexus://repo/eqms-backend/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |
| Work in the Entity area (2414 symbols) | `.claude/skills/generated/entity/SKILL.md` |
| Work in the Service area (2244 symbols) | `.claude/skills/generated/service/SKILL.md` |
| Work in the Eqms area (387 symbols) | `.claude/skills/generated/eqms/SKILL.md` |
| Work in the Controller area (99 symbols) | `.claude/skills/generated/controller/SKILL.md` |
| Work in the Workmanagement area (51 symbols) | `.claude/skills/generated/workmanagement/SKILL.md` |
| Work in the Repository area (44 symbols) | `.claude/skills/generated/repository/SKILL.md` |
| Work in the Auth area (41 symbols) | `.claude/skills/generated/auth/SKILL.md` |
| Work in the Util area (22 symbols) | `.claude/skills/generated/util/SKILL.md` |
| Work in the Workflow area (9 symbols) | `.claude/skills/generated/workflow/SKILL.md` |
| Work in the Bootstrap area (8 symbols) | `.claude/skills/generated/bootstrap/SKILL.md` |
| Work in the Config area (6 symbols) | `.claude/skills/generated/config/SKILL.md` |
| Work in the Exception area (6 symbols) | `.claude/skills/generated/exception/SKILL.md` |
| Work in the Security area (4 symbols) | `.claude/skills/generated/security/SKILL.md` |

<!-- gitnexus:end -->
