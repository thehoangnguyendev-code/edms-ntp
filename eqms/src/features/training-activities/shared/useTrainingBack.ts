import { useLocation, useNavigate } from "react-router-dom";
import { useBackNavigation, type BackNavigationLocationState } from "@/app/navigation/backNavigation";

/**
 * The Back button of a Training page: it returns to the screen the person came from (a review, a record, the dashboard),
 * and goes to the list of the page only when the page was opened directly (a link, a reload in a new tab).
 */
export const useTrainingBack = (fallbackRoute: string) => {
  const navigate = useNavigate();
  const location = useLocation();
  return useBackNavigation(navigate, location.state as BackNavigationLocationState | null, fallbackRoute);
};
