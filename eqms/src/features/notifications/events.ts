export const NOTIFICATIONS_CHANGED_EVENT = 'eqms:notifications-changed';

export const emitNotificationsChanged = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
};

export const subscribeNotificationsChanged = (handler: () => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
};
