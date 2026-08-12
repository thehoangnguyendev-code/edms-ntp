import React from 'react';
import { Lock } from 'lucide-react';
import { Badge, type BadgeSize } from '@/components/ui/badge/Badge';

export type PolicyStatusBadgeValue = 'ACTIVE' | 'DRAFT' | 'DISABLED';

interface PolicyStatusBadgeProps {
  status: PolicyStatusBadgeValue;
  mandatory?: boolean;
  size?: BadgeSize;
}

/** Status pill for a notification policy — a mandatory (GMP-locked) policy always shows a lock
 * icon regardless of status, since it can never actually be disabled (see NotificationPolicyService). */
export const PolicyStatusBadge: React.FC<PolicyStatusBadgeProps> = ({ status, mandatory = false, size = 'sm' }) => {
  if (mandatory) {
    return (
      <Badge color="amber" size={size} icon={<Lock className="h-3 w-3" />}>
        Mandatory
      </Badge>
    );
  }
  switch (status) {
    case 'ACTIVE':
      return <Badge color="emerald" size={size} showDot>Active</Badge>;
    case 'DRAFT':
      return <Badge color="slate" size={size}>Draft</Badge>;
    case 'DISABLED':
    default:
      return <Badge color="gray" size={size}>Disabled</Badge>;
  }
};
