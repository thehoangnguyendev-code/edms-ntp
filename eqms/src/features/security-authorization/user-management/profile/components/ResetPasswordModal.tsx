import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast";
import { settingsApi } from "@/services/api/settings";
import { authApi, type PasswordPolicy } from "@/services/api/auth";
import { DEFAULT_PASSWORD_POLICY } from "@/features/auth/usePasswordPolicy";
import { evaluatePasswordPolicy } from "@/features/auth/passwordPolicyRules";
import { generatePolicyPassword } from "./generatePolicyPassword";
import { cn } from "@/components/ui/utils";
import { tr } from "@/i18n";

interface ResetPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    /** Username, e-mail and name parts of the person: the rule "no user information in the password" is checked against them as the password is typed. */
    userTokens?: string[];
    onSuccess?: (password: string) => void;
}

const extractApiMessage = (error: unknown): string => {
    if (typeof error !== "object" || error === null) return "Unable to reset password.";
    const candidate = error as {
        response?: { data?: { error?: { message?: string }; message?: string; detail?: string; title?: string }; statusText?: string };
        message?: string;
    };
    return (
        candidate.response?.data?.error?.message ||
        candidate.response?.data?.message ||
        candidate.response?.data?.detail ||
        candidate.response?.data?.title ||
        candidate.response?.statusText ||
        candidate.message ||
        "Unable to reset password."
    );
};

/**
 * Reset Password opens straight on a suggested password that already follows the rules switched on in Security > Password Rules. The administrator takes it as it is
 * or edits it; every change is checked at once against the same rules, and Confirm stays off until all of them are met. Only Confirm resets the password and sends it
 * to the person by e-mail (the server checks the rules again, and the password history, and has the last word).
 */
export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen, onClose, userId, userName, userTokens = [], onSuccess }) => {
    const { showToast } = useToast();
    const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
    const [policyNote, setPolicyNote] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [serverError, setServerError] = useState("");

    const tokensKey = userTokens.join("|");
    const tokens = useMemo(() => userTokens.filter(Boolean), [tokensKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const suggest = useCallback((rules: PasswordPolicy) => {
        setPassword(generatePolicyPassword(rules, tokens));
        setServerError("");
    }, [tokens]);

    // The rules are read every time the modal opens, so a change made in Security > Password Rules is used at once.
    useEffect(() => {
        if (!isOpen) {
            setPolicy(null);
            setPolicyNote("");
            setPassword("");
            setServerError("");
            return;
        }
        let cancelled = false;
        authApi.getPasswordPolicy()
            .then((rules) => { if (!cancelled) { setPolicy(rules); suggest(rules); } })
            .catch(() => {
                if (cancelled) return;
                setPolicy(DEFAULT_PASSWORD_POLICY);
                setPolicyNote("The password rules could not be loaded. The basic rules are used here, and the server checks the password against the real ones.");
                suggest(DEFAULT_PASSWORD_POLICY);
            });
        return () => { cancelled = true; };
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const evaluation = useMemo(() => (policy ? evaluatePasswordPolicy(password, policy, tokens) : null), [password, policy, tokens]);
    const canConfirm = Boolean(policy && password && evaluation?.isValid && !isSubmitting);

    const handleCopyPassword = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(password);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = password;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand("copy");
                textArea.remove();
                if (!successful) throw new Error("Fallback copy failed");
            }
            showToast({ type: "success", title: "Copied!", message: tr("Password copied to clipboard") });
        } catch {
            showToast({ type: "error", title: tr("Copy Failed"), message: tr("Failed to copy password") });
        }
    };

    const handleConfirm = async () => {
        if (!canConfirm) return;
        if (!userId) {
            setServerError("User ID is missing. Please reopen the window and try again.");
            return;
        }
        try {
            setIsSubmitting(true);
            setServerError("");
            await settingsApi.resetPassword(userId, { newPassword: password, sendEmail: true });
            onSuccess?.(password);
            showToast({ type: "success", title: tr("Password reset"), message: `The new password was set for ${userName} and is sent to them by e-mail. They must change it at the next sign-in.` });
            onClose();
        } catch (error) {
            // for example a password that was used before: the history is only known to the server
            setServerError(extractApiMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={() => void handleConfirm()}
            title={tr("Reset Password")}
            description={`A suggested password for ${userName} that follows the password rules. Use it as it is or edit it. It is sent to them by e-mail when you confirm.`}
            confirmText="Confirm"
            cancelText="Close"
            confirmDisabled={!canConfirm}
            size="md"
            isLoading={isSubmitting}
        >
            <div className="space-y-4">
                <div>
                    <label htmlFor="reset-password-value" className="mb-1.5 block text-xs font-medium capitalize text-slate-700 sm:text-sm">
                        {tr("New Password")}
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            id="reset-password-value"
                            type="text"
                            value={password}
                            onChange={(event) => { setPassword(event.target.value); setServerError(""); }}
                            disabled={!policy || isSubmitting}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            aria-invalid={Boolean(policy && password && !evaluation?.isValid)}
                            aria-describedby="reset-password-rules"
                            placeholder={policy ? "Enter a password" : "Preparing a suggestion…"}
                            className={cn(
                                "h-10 w-full min-w-0 rounded-lg border bg-white px-3 font-mono text-sm text-slate-900 focus:outline-none focus:ring-1",
                                policy && password && !evaluation?.isValid
                                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                                    : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-500",
                            )}
                        />
                        <Button
                            type="button"
                            onClick={() => policy && suggest(policy)}
                            disabled={!policy || isSubmitting}
                            variant="outline"
                            size="icon-sm"
                            className="flex h-10 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all duration-200 hover:bg-slate-50"
                            title={tr("Suggest another password")}
                            aria-label={tr("Suggest another password")}
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            onClick={handleCopyPassword}
                            disabled={!password}
                            variant="outline"
                            size="icon-sm"
                            className="flex h-10 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all duration-200 hover:bg-slate-50"
                            title={tr("Copy Password")}
                            aria-label={tr("Copy Password")}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <ul id="reset-password-rules" aria-live="polite" className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {evaluation?.checks.map((check) => (
                        <li key={check.key} className={cn("flex items-center gap-2 text-xs sm:text-sm", check.met ? "text-emerald-700" : "text-red-600")}>
                            {check.met ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : <X className="h-4 w-4 shrink-0" aria-hidden="true" />}
                            <span>{check.label}</span>
                            <span className="sr-only">{check.met ? "met" : "not met"}</span>
                        </li>
                    ))}
                    {!evaluation && <li className="text-xs text-slate-500">{tr("Reading the password rules…")}</li>}
                </ul>

                {policyNote && <p className="text-xs text-amber-700">{policyNote}</p>}
                {serverError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:text-sm">{serverError}</p>}
            </div>
        </FormModal>
    );
};
