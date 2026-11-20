import type { NavigateFunction } from "react-router-dom";
import { reportTemplatesApi, reportError } from "@/services/api/reportTemplates";
import { ROUTES } from "@/app/routes.constants";

/**
 * The export of Access Explorer goes through Reports, so that the run is authorized, audited and kept like every other report: it opens the run page of the template made from the Report Type
 * Permission Holders, with the permission already filled in when there is one. When no such template is available to the person, it says so and opens the Report Library.
 */
export async function openPermissionHoldersReport(
  navigate: NavigateFunction,
  notify: (toast: { type: "error" | "info"; message: string }) => void,
  permissionCode?: string,
): Promise<void> {
  try {
    const page = await reportTemplatesApi.list(
      { search: "", page: 1, sortBy: "displayName", direction: "asc", sourceCode: "PERMISSION_HOLDERS" },
      false,
    );
    const template = page.data.find((item) => item.sourceCode === "PERMISSION_HOLDERS");
    if (!template) {
      notify({
        type: "info",
        message: "No report template of the type Permission Holders is available to you. A report administrator creates one in the Report Library; it is then listed there.",
      });
      navigate(ROUTES.REPORT.TEMPLATES);
      return;
    }
    const query = permissionCode ? `?filter.permission=${encodeURIComponent(permissionCode)}` : "";
    navigate(`/report/templates/${encodeURIComponent(template.code)}/run${query}`);
  } catch (e) {
    notify({ type: "error", message: reportError(e) });
  }
}
