import React, { useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { SmartDropdown, DropdownItem, DropdownDivider } from './SmartDropdown';
import { cn } from '../utils';
import { useTranslation } from '@/i18n';

/**
 * ActionDropdown - Table row action menu component
 * 
 * Pre-configured dropdown for common table actions with:
 * - MoreVertical trigger button
 * - Portal rendering
 * - Auto-positioning (flips up when near bottom)
 * - Stop propagation for table row clicks
 * 
 * @example
 * ```tsx
 * <ActionDropdown
 *   actions={[
 *     { label: 'View', icon: <Eye />, onClick: handleView },
 *     { label: 'Edit', icon: <Edit />, onClick: handleEdit },
 *     { type: 'divider' },
 *     { label: 'Delete', icon: <Trash />, onClick: handleDelete, destructive: true },
 *   ]}
 * />
 * ```
 */

export interface ActionItem {
  type?: 'action';
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export interface DividerItem {
  type: 'divider';
}

export type ActionDropdownItem = ActionItem | DividerItem;

export interface ActionDropdownProps {
  /** Array of action items */
  actions: ActionDropdownItem[];
  /** Additional CSS classes for trigger button */
  triggerClassName?: string;
  /** Additional CSS classes for dropdown */
  dropdownClassName?: string;
  /** Size of trigger button */
  size?: 'sm' | 'default' | 'lg';
  /** Disabled state */
  disabled?: boolean;
  /** Custom trigger icon */
  triggerIcon?: React.ReactNode;
  /** Minimum dropdown width */
  minWidth?: number;
}

const SIZE_CLASSES = {
  sm: 'h-9 w-9 sm:h-7 sm:w-7',
  default: 'h-9 w-9 sm:h-8 sm:w-8',
  lg: 'h-10 w-10 sm:h-9 sm:w-9',
};

const ICON_SIZE_CLASSES = {
  sm: 'h-3.5 w-3.5',
  default: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export const ActionDropdown: React.FC<ActionDropdownProps> = ({
  actions,
  triggerClassName,
  dropdownClassName,
  size = 'default',
  disabled = false,
  triggerIcon,
  minWidth = 180,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleActionClick = (action: ActionItem) => {
    action.onClick();
    handleClose();
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={handleTriggerClick}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center rounded-lg transition-colors',
          'hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
          'active:scale-95',
          SIZE_CLASSES[size],
          disabled && 'bg-slate-100 text-slate-400 cursor-not-allowed hover:bg-slate-100',
          triggerClassName
        )}
        aria-label={t('actionDropdown.moreActions')}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {triggerIcon || (
          <MoreVertical className={cn(disabled ? 'text-slate-400' : 'text-slate-600', ICON_SIZE_CLASSES[size])} />
        )}
      </button>

      {/* Dropdown Menu */}
      <SmartDropdown
        isOpen={isOpen}
        onClose={handleClose}
        triggerRef={triggerRef as React.RefObject<HTMLElement>}
        minWidth={minWidth}
        className={dropdownClassName}
      >
        <div className="py-1">
          {actions.map((item, index) => {
            if (item.type === 'divider') {
              return <DropdownDivider key={`divider-${index}`} />;
            }

            return (
              <DropdownItem
                key={`action-${index}-${item.label}`}
                icon={item.icon}
                onClick={() => handleActionClick(item)}
                disabled={item.disabled}
                destructive={item.destructive}
              >
                {item.label}
              </DropdownItem>
            );
          })}
        </div>
      </SmartDropdown>
    </>
  );
};
