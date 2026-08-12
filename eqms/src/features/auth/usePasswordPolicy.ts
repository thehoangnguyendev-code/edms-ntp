import { useEffect, useState } from "react";
import { authApi, type PasswordPolicy } from "@/services/api/auth";

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  passwordMinLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

/** Keeps password forms aligned with the server-enforced system policy. */
export const usePasswordPolicy = () => {
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);

  useEffect(() => {
    void authApi.getPasswordPolicy().then(setPasswordPolicy).catch(() => undefined);
  }, []);

  return passwordPolicy;
};
