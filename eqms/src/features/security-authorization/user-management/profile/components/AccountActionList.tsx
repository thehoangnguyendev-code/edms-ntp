import React from "react";
import { Button } from "@/components/ui/button/Button";
import { IconTile } from "@/components/ui/icon-tile";
import type { AccountAction } from "./accountActions";

/** One row per account action: what it does, and the button that does it. */
export const AccountActionList: React.FC<{ actions: AccountAction[] }> = ({ actions }) => (
  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
    {actions.map((action) => (
      <li key={action.key} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between md:p-4">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={action.icon} color={action.destructive ? "red" : "slate"} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">{action.label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{action.description}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant={action.destructive ? "destructive" : "outline-emerald"}
          onClick={action.onClick}
          className="whitespace-nowrap sm:flex-shrink-0"
        >
          {action.label}
        </Button>
      </li>
    ))}
  </ul>
);
