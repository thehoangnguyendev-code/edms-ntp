import { Badge } from "@/components/ui/badge/Badge";
import type { TrainingFormTemplate } from "@/services/api/trainingActivities";

/** What the check of a template found: tokens that agree with the form, tokens that do not, an earlier template (found by its printed words), or nothing to check. */
export function TokenCheckBadge({ template }: { template: Pick<TrainingFormTemplate, "tokenMode" | "checkProblems"> }) {
  if (template.tokenMode === "TOKENS") {
    return template.checkProblems ? <Badge color="red">Tokens do not agree</Badge> : <Badge color="emerald">Tokens agree</Badge>;
  }
  if (template.tokenMode === "LEGACY") return <Badge color="amber">Legacy, tokens not checked</Badge>;
  return <Badge color="slate">Not applicable</Badge>;
}
