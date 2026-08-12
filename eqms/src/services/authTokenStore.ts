let accessToken: string | null = null;

export const authTokenStore = {
  get: (): string | null => accessToken,
  set: (token: string | null | undefined): void => {
    accessToken = token && token.trim() ? token : null;
  },
  clear: (): void => {
    accessToken = null;
  },
};
