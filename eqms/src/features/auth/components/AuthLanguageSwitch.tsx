import React, { useMemo } from "react";
import { LANGUAGE_FLAG_ICONS } from "@/components/ui/flags/Flags";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { LANGUAGE_OPTIONS, useLanguage, type ApplicationLanguage } from "@/i18n";

/**
 * The Tiếng Việt / English switch of the sign-in screens, the same choice as the sidebar of the application. Before sign-in the choice is remembered on this device; after sign-in it is
 * saved to the account (LanguageProvider decides which).
 */
export const AuthLanguageSwitch: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { language, setLanguage, t } = useLanguage();
  const tabs = useMemo<readonly TabItem[]>(
    () => LANGUAGE_OPTIONS.map((option) => ({ id: option.value, label: option.label, icon: LANGUAGE_FLAG_ICONS[option.value] })),
    [],
  );
  return (
    <div className={className} data-auth-language>
      <TabNav
        tabs={tabs}
        activeTab={language}
        onChange={(id) => void setLanguage(id as ApplicationLanguage)}
        variant="pill"
        ariaLabel={t("shell.language", "Language")}
        tabIdPrefix="auth-language"
      />
    </div>
  );
};
