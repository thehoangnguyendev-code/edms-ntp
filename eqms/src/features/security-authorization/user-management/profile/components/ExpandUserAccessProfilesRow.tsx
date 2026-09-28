import React, { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge/Badge";

interface ExpandUserAccessProfilesRowProps {
  userId: string;
  accessProfileNames: string[];
  isExpanded: boolean;
  /** Total column count of the outer table (visible data columns + the leading chevron column +
   *  the trailing Action column) -- the expand row spans all of it. */
  totalColumnsCount: number;
}

/** Mirrors ExpandControlledCopiesRow's visual pattern (documents/controlled-copies) for a
 *  different kind of child list: the real Access Profile(s) assigned to one user
 *  (user_access_profiles), already loaded with the row -- no separate fetch needed here since the
 *  list is short and comes back with the page itself (UserManagementResponse.accessProfileNames). */
export const ExpandUserAccessProfilesRow: React.FC<ExpandUserAccessProfilesRowProps> = ({
  userId,
  accessProfileNames,
  isExpanded,
  totalColumnsCount,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = useMemo(
    () => (shouldReduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 16 }),
    [shouldReduceMotion],
  );

  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.tr
          key={`expanded-user-access-profiles-${userId}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionConfig}
          className="bg-slate-50/50"
        >
          <td colSpan={totalColumnsCount} className="p-0 border-b border-slate-200">
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={transitionConfig}
              className="overflow-hidden"
            >
              <div className="p-4 md:p-5">
                <div className="ml-9 flex flex-col gap-4 items-start">
                  {accessProfileNames.length > 0 ? (
                    <div className="w-full">
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Access Profiles ({accessProfileNames.length})
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
                        <table className="text-xs table-auto w-auto">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200">
                              <th className="py-1.5 px-2.5 text-center text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap w-10">No.</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Access Profile</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {accessProfileNames.map((name, idx) => (
                              <tr key={name} className="hover:bg-slate-50 transition-colors">
                                <td className="py-1.5 px-2.5 text-center text-slate-500 font-medium border-b border-slate-100">{idx + 1}</td>
                                <td className="py-1.5 px-2.5 text-slate-700 border-b border-slate-100">
                                  {name}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-500">
                      No Access Profile assigned -- this user cannot use any permission-gated function until one is granted.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </td>
        </motion.tr>
      )}
    </AnimatePresence>
  );
};
