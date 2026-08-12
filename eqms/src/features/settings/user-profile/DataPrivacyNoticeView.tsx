import React from "react";
import {
  Database,
  FileText,
  LockKeyhole,
  Scale,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form/FormSection";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { myProfile } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import notice from "./dataPrivacyNotice.json";

const icons = {
  file: FileText,
  database: Database,
  scale: Scale,
  users: UsersRound,
  lock: LockKeyhole,
  shield: ShieldCheck,
};
type NoticeSection = {
  id: string;
  title: string;
  icon: keyof typeof icons;
  paragraphs: string[];
  bullets?: string[];
  notice?: { title: string; description: string };
};

export const DataPrivacyNoticeView: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={notice.title}
        breadcrumbItems={[
          ...myProfile(navigate),
          { label: notice.title, isActive: true },
        ]}
        actions={
          <Button
            size="sm"
            variant="outline-emerald"
            onClick={() => navigate("/profile")}
          >
            Back to Profile
          </Button>
        }
      />
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="space-y-6">
          <WarningBanner variant="info" title={notice.intro.title}>
            {notice.intro.description}
          </WarningBanner>
          {(notice.sections as NoticeSection[]).map((section) => {
            const Icon = icons[section.icon];
            return (
              <FormSection
                key={section.id}
                title={section.title}
                icon={<Icon className="h-4 w-4" />}
              >
                <div className="space-y-3 text-sm leading-6 text-slate-600">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.bullets && (
                    <ul className="list-disc space-y-1 pl-5">
                      {section.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {section.notice && (
                    <WarningBanner
                      variant="warning"
                      title={section.notice.title}
                    >
                      {section.notice.description}
                    </WarningBanner>
                  )}
                </div>
              </FormSection>
            );
          })}
        </div>
      </div>
    </div>
  );
};
