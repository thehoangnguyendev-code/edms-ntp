import { useCallback, useEffect, useState } from "react";
import { reportTemplatesApi, type ReportTemplateCapabilities } from "@/services/api/reportTemplates";

/**
 * What the current user may do to one report template, as the server decides it from the user's permissions (ticked in a Permission Set), the state of
 * the template and, for a decision, who wrote the revision. The screens show only what this says; no screen names an account or a role.
 * The server checks every action again when it is carried out. `refreshKey` loads the answer again when the template changed.
 */
export function useReportTemplateCapabilities(code: string, refreshKey = "") {
  const [capabilities, setCapabilities] = useState<ReportTemplateCapabilities>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!code) {
      setCapabilities(undefined);
      setLoaded(true);
      return;
    }
    let alive = true;
    setLoaded(false);
    reportTemplatesApi
      .capabilities(code)
      .then((value) => alive && setCapabilities(value))
      .catch(() => alive && setCapabilities(undefined))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [code, refreshKey]);

  const can = useCallback((action: string) => capabilities?.actions?.[action]?.allowed === true, [capabilities]);
  const reason = useCallback((action: string) => capabilities?.actions?.[action]?.reasonCode ?? null, [capabilities]);
  return { can, reason, loaded, capabilities };
}
