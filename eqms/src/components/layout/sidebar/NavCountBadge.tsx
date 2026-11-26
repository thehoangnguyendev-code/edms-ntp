import React, { useRef } from "react";
import { useCountBump } from "@/hooks/useCountBump";

/**
 * The count of a sidebar entry, written in brackets after its name (unread notifications, pending work). It stays mounted while the count is 0 or not known yet, and shows nothing then,
 * so that a count that rises from 0 pops like any other rise (see `useCountBump`).
 */
export const NavCountBadge: React.FC<{ value: number | undefined; className: string }> = ({ value, className }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useCountBump(ref, value);
  if (value === undefined || value <= 0) return null;
  return <span ref={ref} className={className}>({value > 99 ? "99+" : value})</span>;
};
