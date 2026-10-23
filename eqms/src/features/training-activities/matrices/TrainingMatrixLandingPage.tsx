import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { usePermissions } from "@/hooks/usePermissions";
import { trainingMatrixApi } from "@/services/api/trainingActivities";
import { trainingBreadcrumbs } from "../shared/trainingLabels";
import { TrainingMatrixListView } from "./TrainingMatrixListView";

/**
 * The way into the training matrix. The matrix is kept per department (SOP.0003 5.3.1): the head of a department works on the matrix of that department, so the
 * menu opens it at once (the version in use, or the one being prepared). A person who sees all departments, as QA does, starts from the list of every department.
 * A department with no matrix yet also shows the list, which is where a matrix is created.
 */
export function TrainingMatrixLandingPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const seesAll = hasPermission("training.scope.all");
  const [showList, setShowList] = useState(seesAll);

  useEffect(() => {
    if (seesAll) return;
    let alive = true;
    trainingMatrixApi.list({ page: 1, limit: 1 }).then((page) => {
      if (!alive) return;
      const own = page.data[0];
      const target = own?.effectiveVersionId ?? own?.openVersionId;
      if (target) navigate(`/training-management/matrix/${target}`, { replace: true });
      else setShowList(true);
    }).catch(() => { if (alive) setShowList(true); });
    return () => { alive = false; };
  }, [seesAll, navigate]);

  if (showList) return <TrainingMatrixListView />;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title="Training Matrix" breadcrumbItems={trainingBreadcrumbs(navigate, "matrices")} />
      <SectionLoading text="Opening the matrix of your department…" />
    </div>
  );
}
