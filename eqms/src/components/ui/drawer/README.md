# Drawer

Shared non-filter drawer based on the Training floating-panel design.
Import `Drawer`, `DrawerProps`, and `DrawerHandle` from `@/components/ui/drawer`.

- Desktop (768px+): 500px floating panel, 16px viewport inset, rounded corners and shadow.
- Mobile: 88dvh bottom sheet, safe-area padding, pointer drag handle and keyboard resizing.
- Common header, optional description/badge/icon, scrollable body and optional fixed footer.
- Portal, Escape/backdrop dismissal, focus trap/restore, stacked scroll locks and reduced motion.

```tsx
const drawer = useRef<DrawerHandle>(null);
return <Drawer
  ref={drawer}
  open={open}
  title="Record details"
  subtitle="Record type"
  onClose={() => setOpen(false)}
  footer={<Button variant="outline" size="sm" onClick={() => drawer.current?.close()}>Close</Button>}
>
  {content}
</Drawer>;
```

`open` defaults to true for existing conditionally mounted drawers. A user dismissal
animates out first, then calls `onClose` once. An external `open=false` does not call
`onClose`; it calls `onExited` when the exit finishes. Use `onExited` when opening a
second modal after closing the drawer (Calendar personal-event details).

Consumers: CalendarDayDrawer, VersionHistoryDrawer, LearningHistoryDrawer,
CellDetailDrawer, HeaderActionDrawer, AccessProfilePermissionSetDrawer, WorkflowRoleDrawer.
FilterDrawer, inline mobile filter drawers, sidebar navigation and modal/dropdown
components intentionally remain separate.
