import { useState, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { motion, useReducedMotion } from 'framer-motion';
import { GripVertical, Columns2, RectangleHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button/Button';
import { TabNav } from '@/components/ui/tabs';
import { cn } from '@/components/ui/utils';
import type { DashboardWidgetSetting } from './dashboardLayout';
import styles from './DashboardWidgets.module.css';

type Props = {
  item: DashboardWidgetSetting; editing: boolean; disabled: boolean; sorting: boolean; resizeVersion: number; index: number; children: ReactNode;
  onWidth: (width: 'half' | 'full') => void; onMove: (delta: number) => void;
};

const widthTabs = [
  { id: 'half', label: 'Half', icon: Columns2 },
  { id: 'full', label: 'Full', icon: RectangleHorizontal },
] as const;
const resizeMotion = { layout: { duration: 0.65, ease: [0.4, 0, 0.2, 1] as const } };

/** Keep Motion's resize projection inside the element controlled by dnd-kit. */
export function DashboardWidgetTile({ item, editing, disabled, sorting, resizeVersion, index, children, onWidth, onMove }: Props) {
  const reduced = useReducedMotion();
  const [resizing, setResizing] = useState(false);
  const { ref, handleRef, isDragSource } = useSortable({
    id: item.id, index, disabled: !editing || disabled,
    transition: reduced ? null : { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', idle: false },
  });

  return <div ref={ref} data-dashboard-widget={item.id} data-widget-width={item.width} data-widget-resizing={resizing || undefined}
    className={cn(styles.tile, item.width === 'full' && styles.full)}>
    <motion.div className={cn(styles.surface, editing && styles.editing)}
      layout={!sorting && !reduced} layoutDependency={resizeVersion}
      transition={resizeMotion}
      onLayoutAnimationStart={() => setResizing(true)} onLayoutAnimationComplete={() => setResizing(false)}>
      <div className={cn(styles.pulse, editing && !sorting && !resizing && !reduced && styles.breathing)} style={{ animationDelay: `${index % 4 * -0.4}s` }}>
        <motion.div layout={!sorting && !reduced ? 'position' : false} layoutDependency={resizeVersion} transition={resizeMotion}
          hidden={!editing} className={editing ? styles.controls : 'hidden'}>
          <Button ref={handleRef} data-dashboard-grip size="sm" variant="ghost" className={styles.grip}
            aria-label={`Move ${item.label}`} title="Drag to move. Space to pick up, arrow keys to move, Space to drop, Escape to cancel." disabled={disabled || resizing}
            onKeyDown={event => {
              // Direct arrow movement remains a shortcut when no sensor operation is active.
              if (!isDragSource && !sorting && ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) {
                event.preventDefault(); onMove(event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1);
              }
            }}><GripVertical className="h-4 w-4 shrink-0" /><span className="truncate">{item.label}</span></Button>
          <fieldset className={cn(styles.sizes, 'min-w-0 border-0 p-0 disabled:opacity-50')} disabled={disabled || sorting}>
            <TabNav tabs={widthTabs} activeTab={item.width} variant="pill" ariaLabel={`Width of ${item.label}`}
              tabIdPrefix={`dashboard-width-${item.id}`} onChange={width => {
                if (!disabled && !sorting && (width === 'half' || width === 'full')) onWidth(width);
              }} />
          </fieldset>
        </motion.div>
        <motion.div layout={!sorting && !reduced ? 'position' : false} layoutDependency={resizeVersion} transition={resizeMotion}
          className={styles.content} inert={editing || undefined}>{children}</motion.div>
      </div>
    </motion.div>
  </div>;
}
