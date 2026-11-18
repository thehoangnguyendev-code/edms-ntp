/** The words of a person that must not appear in their password: username, the name of their e-mail, the e-mail and the parts of the name. */
export const passwordUserTokens = (user: { username?: string | null; email?: string | null; fullName?: string | null }): string[] =>
  [user.username, user.email?.split("@")[0], user.email, ...(user.fullName ?? "").split(/\s+/)].map((t) => (t ?? "").trim()).filter((t) => t.length >= 3);
