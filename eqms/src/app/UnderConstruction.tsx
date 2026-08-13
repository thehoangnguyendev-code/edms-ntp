import React from 'react';
import { Construction } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface UnderConstructionProps {
  moduleName?: string;
}

export const UnderConstruction: React.FC<UnderConstructionProps> = ({ moduleName }) => {
  const { t } = useTranslation();
  return (
  <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
    <div className="mx-auto h-24 w-24 rounded-full bg-slate-50 flex items-center justify-center mb-4">
      <Construction className="h-10 w-10 text-amber-500" />
    </div>
    <h2 className="text-xl font-bold text-slate-900">{t('system.underConstruction.title')}</h2>
    <p className="text-slate-500 mt-2 max-w-md mx-auto">
      {moduleName ? (
        <>
          {t('system.underConstruction.modulePrefix')} <strong>{moduleName}</strong> {t('system.underConstruction.moduleSuffix')}
        </>
      ) : (
        t('system.underConstruction.description')
      )}
    </p>
  </div>
  );
};
