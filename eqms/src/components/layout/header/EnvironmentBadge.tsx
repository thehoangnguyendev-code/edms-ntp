import React, { useEffect, useState } from 'react';
import { Badge } from '../../ui/badge/Badge';
import { systemEnvironmentApi, type DeploymentEnvironment } from '@/services/api/systemEnvironment';

const LABEL: Record<Exclude<DeploymentEnvironment, 'PROD'>, { text: string; title: string; color: 'blue' | 'amber' }> = {
  DEV: { text: 'DEV', title: 'Development environment. Data here is not a GMP record.', color: 'blue' },
  TEST: { text: 'TEST', title: 'Validation environment. Synthetic data only; not a GMP record.', color: 'amber' },
};

let cached: DeploymentEnvironment | undefined;

/**
 * Always tells the user which environment they are in, so a test action is never mistaken for a production one.
 * DEV and TEST are labelled; PROD shows nothing, because it is the normal state of the system. A failure to read the
 * environment shows nothing rather than guessing.
 */
export const EnvironmentBadge: React.FC = () => {
  const [environment, setEnvironment] = useState<DeploymentEnvironment | undefined>(cached);

  useEffect(() => {
    if (cached) return undefined;
    let cancelled = false;
    systemEnvironmentApi
      .get()
      .then((value) => {
        cached = value;
        if (!cancelled) setEnvironment(value);
      })
      .catch(() => {
        /* not critical to the page */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!environment || environment === 'PROD') return null;
  const label = LABEL[environment];
  return (
    <span title={label.title} data-testid="environment-badge">
      <Badge color={label.color} size="sm">
        {label.text}
      </Badge>
    </span>
  );
};

/** For tests: forget the environment read earlier. */
export const resetEnvironmentBadgeCache = () => {
  cached = undefined;
};
