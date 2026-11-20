import React from 'react';
import { Badge } from '@/components/ui/badge/Badge';
import { CopyButton } from '@/components/ui/button/CopyButton';
import { TableMarkup } from '@/components/ui/table/TablePrimitives';

/** What the server generates for each registered data domain (see the Storage Layout text of the tab). `null` while it is still loading. */
export interface StoragePathPreviewLike {
  documents: string;
  controlledCopies: string;
  templates: string;
  training: string;
  auditEvidence: string;
}

interface StorageLayoutTableProps {
  preview: StoragePathPreviewLike | null;
}

/** The bucket each domain is written to, as the tab has always said it: records in the locked records bucket, templates in the templates bucket. Reserved domains have none yet. */
const DOMAINS: ReadonlyArray<{ key: keyof StoragePathPreviewLike; name: string; bucket: string; reserved: boolean }> = [
  { key: 'documents', name: 'Documents', bucket: 'Locked records bucket', reserved: false },
  { key: 'controlledCopies', name: 'Controlled Copies', bucket: 'Locked records bucket', reserved: false },
  { key: 'templates', name: 'Templates', bucket: 'Templates bucket', reserved: false },
  { key: 'training', name: 'Training', bucket: '—', reserved: true },
  { key: 'auditEvidence', name: 'Audit evidence', bucket: '—', reserved: true },
];

/** The registered data domains and the object keys the server builds for them, one row each, with a button that copies the key. */
export const StorageLayoutTable: React.FC<StorageLayoutTableProps> = ({ preview }) => (
  <div className="overflow-x-auto rounded-lg border border-slate-200">
    <TableMarkup.Root className="w-full min-w-[640px] text-left">
      <TableMarkup.Head className="bg-slate-50">
        <TableMarkup.Row>
          {['Domain', 'Bucket', 'Object key', 'Status'].map((heading) => (
            <TableMarkup.HeaderCell key={heading} scope="col" className="px-4 py-3 text-2xs font-semibold uppercase tracking-wide text-slate-500 md:text-xs">{heading}</TableMarkup.HeaderCell>
          ))}
          <TableMarkup.HeaderCell scope="col" className="w-12 px-2 py-3"><span className="sr-only">Copy</span></TableMarkup.HeaderCell>
        </TableMarkup.Row>
      </TableMarkup.Head>
      <TableMarkup.Body className="divide-y divide-slate-100">
        {DOMAINS.map((domain) => {
          const key = preview?.[domain.key];
          return (
            <TableMarkup.Row key={domain.key} className={domain.reserved ? 'text-slate-500' : 'text-slate-800'}>
              <TableMarkup.HeaderCell scope="row" className="whitespace-nowrap px-4 py-3 text-sm font-medium">{domain.name}</TableMarkup.HeaderCell>
              <TableMarkup.Cell className="whitespace-nowrap px-4 py-3 text-sm">{domain.bucket}</TableMarkup.Cell>
              <TableMarkup.Cell className="break-all px-4 py-3 font-mono text-2xs md:text-xs">{key || 'Loading server-generated path…'}</TableMarkup.Cell>
              <TableMarkup.Cell className="px-4 py-3">
                <Badge semantic={domain.reserved ? 'neutral' : 'success'}>{domain.reserved ? 'Reserved' : 'In use'}</Badge>
              </TableMarkup.Cell>
              <TableMarkup.Cell className="px-2 py-1">{key ? <CopyButton value={key} label={`Copy the object key of ${domain.name}`} /> : null}</TableMarkup.Cell>
            </TableMarkup.Row>
          );
        })}
      </TableMarkup.Body>
    </TableMarkup.Root>
  </div>
);
