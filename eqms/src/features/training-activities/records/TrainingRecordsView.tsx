import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TrainingRecordsTable } from "./components/TrainingRecordsTable";
import { trainingBreadcrumbs, TRAINING_PAGES } from "../shared/trainingLabels";

/** Training records of the people in the department of the person (all departments with the right). A record is never edited; a wrong one is voided. */
export function TrainingRecordsView() {
  const navigate = useNavigate();
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={TRAINING_PAGES.records.title} breadcrumbItems={trainingBreadcrumbs(navigate, "records")} />
      <TrainingRecordsTable mine={false} />
    </div>
  );
}
