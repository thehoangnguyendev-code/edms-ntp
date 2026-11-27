import { tr as __ariaTr } from "@/i18n";
import { tr } from "@/i18n";
import React, { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Briefcase, GraduationCap, History, ShieldCheck, User as UserIcon, UserCog } from "lucide-react";
import { FormSection } from "@/components/ui/form/FormSection";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { IconUserCheck } from "@tabler/icons-react";

export type ProfileTabId = "personal" | "employment" | "qualifications" | "account" | "security" | "audit";

/** The five areas of a user record. The profile and the Add User screen show the same ones. */
export const PROFILE_TABS: ReadonlyArray<{ id: ProfileTabId; label: string; icon: React.ElementType }> = [
  { id: "personal", get label() { return tr("Personal & Identity"); }, icon: UserIcon },
  { id: "employment", get label() { return tr("Employment Record"); }, icon: Briefcase },
  { id: "qualifications", get label() { return tr("Training & Competency"); }, icon: GraduationCap },
  { id: "account", get label() { return tr("Account Status"); }, icon: IconUserCheck },
  { id: "security", get label() { return tr("Security & Compliance"); }, icon: ShieldCheck },
];

/** The sixth tab of a saved profile: everything the user did (not part of Add User). */
export const AUDIT_PROFILE_TAB = { id: "audit" as const, get label() { return tr("Audit Trail"); }, icon: History };
const ALL_PROFILE_TABS: ReadonlyArray<{ id: ProfileTabId; label: string; icon: React.ElementType }> = [...PROFILE_TABS, AUDIT_PROFILE_TAB];

/** `TabItem`s for the five areas; `extra` adds a description or a count to a tab. */
export const profileTabItems = (extra?: (id: ProfileTabId) => Partial<TabItem>): TabItem[] =>
  PROFILE_TABS.map((tab) => ({ id: tab.id, label: tab.label, icon: tab.icon, ...extra?.(tab.id) }));

interface ProfileTabLayoutProps {
  /** Card above the tabs: who the user is (profile) or how far the form is (Add User). */
  summary: React.ReactNode;
  tabs: TabItem[];
  activeTab: ProfileTabId;
  onTabChange: (id: ProfileTabId) => void;
  /** Hide the per-tab description in the side list (the profile shows labels only). */
  compactNav?: boolean;
  /** Shown at the right of the panel header, e.g. an "Editing" badge. */
  panelBadge?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Summary and tab list in a column on the left (a row of tabs above the content on narrow
 * screens), the active tab's content on the right.
 */
export const ProfileTabLayout: React.FC<ProfileTabLayoutProps> = ({
  summary,
  tabs,
  activeTab,
  onTabChange,
  compactNav = true,
  panelBadge,
  children,
}) => {
  const current = ALL_PROFILE_TABS.find((tab) => tab.id === activeTab) ?? PROFILE_TABS[0];
  const Icon = current.icon;
  const isWide = useMediaQuery("(min-width: 1024px)");

  // The content comes in from the side the tab sits on: a tab further down the list brings it up from below, one further up brings it down
  // from above. The first view does not animate, and a person who asks for less motion only gets the fade.
  const reduceMotion = useReducedMotion();
  const order = ALL_PROFILE_TABS.findIndex((tab) => tab.id === activeTab);
  const previousOrder = useRef(order);
  const hasMounted = useRef(false);
  const direction = order >= previousOrder.current ? 1 : -1;
  useEffect(() => {
    previousOrder.current = order;
    hasMounted.current = true;
  }, [order]);
  return (
    <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-4">
        {summary}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:p-2">
          <TabNav
            tabs={tabs}
            activeTab={activeTab}
            onChange={(id) => onTabChange(id as ProfileTabId)}
            variant={isWide ? "vertical" : "underline"}
            compactVertical={compactNav}
            ariaLabel={__ariaTr("User record sections")}
          />
        </div>
      </aside>
      <motion.div
        key={activeTab}
        className="min-w-0"
        initial={hasMounted.current ? { opacity: 0, y: reduceMotion ? 0 : direction * 14 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
        {activeTab === "qualifications" || activeTab === "audit" ? (
          // Its three lists are cards of their own; an outer card would put a card in a card.
          children
        ) : (
          <FormSection
            title={current.label}
            icon={<Icon className="h-4 w-4" />}
            headerRight={panelBadge}
            className="shadow-sm"
          >
            {children}
          </FormSection>
        )}
      </motion.div>
    </div>
  );
};
