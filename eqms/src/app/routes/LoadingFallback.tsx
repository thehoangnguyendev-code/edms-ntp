import React from 'react';
import { Loading } from '@/components/ui/loading/Loading';

export const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loading size="default" text="Loading..." />
  </div>
);
