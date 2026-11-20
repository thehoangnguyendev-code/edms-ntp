import React from 'react';

/** A titled block of an Integrations tab: what it is for in one line, then its content. Header `px-4 md:px-5 py-3`, body `p-4 md:p-5`, like every card of the system. */
export const IntegrationSectionCard: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <section className="rounded-xl border border-slate-200 bg-white">
    <div className="border-b border-slate-100 px-4 py-3 md:px-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
    <div className="space-y-4 p-4 md:p-5">{children}</div>
  </section>
);
