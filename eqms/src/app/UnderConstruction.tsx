import React from 'react';
import { Construction } from 'lucide-react';

interface UnderConstructionProps {
  moduleName?: string;
}

export const UnderConstruction: React.FC<UnderConstructionProps> = ({ moduleName }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
    <div className="mx-auto h-24 w-24 rounded-full bg-slate-50 flex items-center justify-center mb-4">
      <Construction className="h-10 w-10 text-amber-500" />
    </div>
    <h2 className="text-xl font-bold text-slate-900">Module Under Construction</h2>
    <p className="text-slate-500 mt-2 max-w-md mx-auto">
      {moduleName ? (
        <>
          The <strong>{moduleName}</strong> module is currently being built.
          Compliance logic is being implemented.
        </>
      ) : (
        'This module is currently being built. Compliance logic is being implemented.'
      )}
    </p>
  </div>
);
