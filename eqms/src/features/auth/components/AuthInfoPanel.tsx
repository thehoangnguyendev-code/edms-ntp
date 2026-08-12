import React from "react";
import { AUTH_PARTNER_BRANDS, AUTH_UI } from "../auth-ui";

interface AuthInfoPanelProps {
  title: string;
  body: React.ReactNode;
  footerTitle: string;
  footerSubtitle: string;
}

export const AuthInfoPanel: React.FC<AuthInfoPanelProps> = ({
  title,
  body,
  footerTitle,
  footerSubtitle,
}) => {
  return (
    <>
      <div className={AUTH_UI.rightPanelGlow} />

      <div className={AUTH_UI.rightPanelHero}>
        <h2 className="text-3xl font-medium leading-[1.2] tracking-tight text-emerald-50 lg:text-4xl xl:text-5xl">
          {title}
        </h2>

        <div className="space-y-5">{body}</div>

        <div className="pt-2">
          <p className="text-base font-semibold text-white">{footerTitle}</p>
          <p className="text-sm text-emerald-100/90">{footerSubtitle}</p>
        </div>
      </div>

      <div className={AUTH_UI.rightPanelFooter}>
        <div className={AUTH_UI.modulesHeader}>
          <span className="text-xs uppercase tracking-[0.14em] text-emerald-200/80">EQMS Modules</span>
          <span className="h-px flex-1 bg-emerald-200/30" />
        </div>
        <div className={AUTH_UI.modulesGrid}>
          {AUTH_PARTNER_BRANDS.map((brand) => (
            <span key={brand}>{brand}</span>
          ))}
        </div>
      </div>
    </>
  );
};
