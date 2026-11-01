import { useEffect, useState } from "react";
import { trainingRecordsApi } from "@/services/api/trainingActivities";

/** The department of the signed-in person, which the department filters open on. `loaded` is true once the server has answered (also when the person has no department). */
export function useOwnDepartment() {
  const [state, setState] = useState<{ loaded: boolean; id: string }>({ loaded: false, id: "" });
  useEffect(() => {
    let alive = true;
    trainingRecordsApi.myDepartment().then((d) => alive && setState({ loaded: true, id: d.id ?? "" })).catch(() => alive && setState({ loaded: true, id: "" }));
    return () => { alive = false; };
  }, []);
  return state;
}

/** The options of a department filter: the departments only. A person without a department must choose one first. */
export function departmentOptions(departments: { label: string; value: string }[], ownId: string) {
  return ownId ? departments : [{ label: "Select Department", value: "" }, ...departments];
}
