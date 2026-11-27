import React from 'react';
import { IconDatabase, IconNetwork, IconServer } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge/Badge';
import type { IntegrationConfig } from '../types';
import { tr } from "@/i18n";

type Provider = IntegrationConfig['storage']['provider'];

interface StorageProviderCardsProps {
  value: Provider;
  onChange: (provider: Provider) => void;
}

/** Only what the screen and the code already say about each provider: nothing here is a claim the system does not make elsewhere. */
const PROVIDERS: ReadonlyArray<{ value: Provider; name: string; text: string; icon: React.ReactNode; badge?: React.ReactNode }> = [
  {
    value: 'minio',
    name: 'MinIO',
    text: 'S3 API object storage. The system enables Versioning and Object Lock Compliance on the bucket.',
    icon: <IconDatabase className="h-5 w-5" />,
    get badge() { return <Badge semantic="success">{tr("Recommended")}</Badge>; },
  },
  {
    value: 'nas',
    name: 'Network Attached Storage',
    text: 'A shared folder reached over SMB: host, shared folder name, domain and the account of a service user.',
    icon: <IconNetwork className="h-5 w-5" />,
  },
  {
    value: 'local',
    name: 'Local Server',
    text: 'A folder on the application server. It is not part of the backup, so a lost disk loses the files.',
    icon: <IconServer className="h-5 w-5" />,
    get badge() { return <Badge semantic="warning">{tr("Not backed up")}</Badge>; },
  },
];

/** The storage provider as three cards instead of a list, so that what each choice means is read before it is chosen. Native radio buttons: the arrow keys work. */
export const StorageProviderCards: React.FC<StorageProviderCardsProps> = ({ value, onChange }) => (
  <fieldset>
    <legend className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">{tr("Storage Provider")}</legend>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {PROVIDERS.map((provider) => (
        <label key={provider.value} className="relative block cursor-pointer">
          <input
            type="radio"
            name="storage-provider"
            value={provider.value}
            checked={value === provider.value}
            onChange={() => onChange(provider.value)}
            className="peer sr-only"
          />
          <span className="block h-full rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 peer-checked:border-emerald-500 peer-checked:bg-emerald-50/40 peer-checked:ring-1 peer-checked:ring-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500">
            <span className="flex items-start justify-between gap-2">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${value === provider.value ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>{provider.icon}</span>
              {provider.badge}
            </span>
            <span className="mt-2 block text-sm font-semibold text-slate-900">{tr(provider.name)}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{tr(provider.text)}</span>
          </span>
        </label>
      ))}
    </div>
  </fieldset>
);
