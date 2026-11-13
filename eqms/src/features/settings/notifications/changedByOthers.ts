/**
 * The server refuses a change to something that someone else saved after this person opened it (409). It says so in words; this tells that refusal from the other
 * refusals, so the screen can offer to reload instead of only showing an error.
 */
export const isChangedByOthers = (error: unknown): boolean => {
  const response = (error as { response?: { status?: number; data?: { error?: { message?: string }; message?: string } } })?.response;
  const message = response?.data?.error?.message ?? response?.data?.message ?? '';
  return response?.status === 409 && /changed by someone else/i.test(message);
};

export const CHANGED_BY_OTHERS_TITLE = 'Someone else changed this after you opened it.';
export const CHANGED_BY_OTHERS_TEXT = 'Your change was not saved, so nothing of theirs is lost. Reload to see their change; reloading discards what you typed here, so copy it first if you need it.';
