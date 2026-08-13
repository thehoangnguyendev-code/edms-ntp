import React from "react";
import { Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { settingsApi } from "@/services/api/settings";
import { useEffect, useState } from "react";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { useTranslation } from "@/i18n";

interface ResetPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    onSuccess?: (password: string) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
    isOpen,
    onClose,
    userId,
    userName,
    onSuccess,
}) => {
    const { showToast } = useToast();
    const { t } = useTranslation();
    const { requestSignature, signatureModal } = useSecurityESign();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState("");
    const [resultModal, setResultModal] = useState<{
        isOpen: boolean;
        type: "success" | "error";
        title: string;
        message: string;
    }>({
        isOpen: false,
        type: "success",
        title: "",
        message: "",
    });

    useEffect(() => {
        if (!isOpen) {
            setGeneratedPassword("");
        }
    }, [isOpen]);


    const handleCopyPassword = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(generatedPassword);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = generatedPassword;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                textArea.remove();
                if (!successful) {
                    throw new Error('Fallback copy failed');
                }
            }

            showToast({
                type: "success",
                title: t("resetPassword.copiedTitle"),
                message: t("resetPassword.copiedMessage"),
            });
        } catch (err) {
            console.error('Failed to copy password:', err);
            showToast({
                type: "error",
                title: t("resetPassword.copyFailedTitle"),
                message: t("resetPassword.copyFailedMessage"),
            });
        }
    };

    const extractApiMessage = (error: unknown): string => {
        if (typeof error !== "object" || error === null) {
            return t("resetPassword.failedMessage");
        }

        const candidate = error as {
            response?: {
                data?: {
                    error?: { message?: string };
                    message?: string;
                    detail?: string;
                    title?: string;
                };
                statusText?: string;
            };
            message?: string;
        };

        return (
            candidate.response?.data?.error?.message ||
            candidate.response?.data?.message ||
            candidate.response?.data?.detail ||
            candidate.response?.data?.title ||
            candidate.response?.statusText ||
            candidate.message ||
            t("resetPassword.failedMessage")
        );
    };

    const handleConfirmReset = async () => {
        if (!userId) {
            setResultModal({
                isOpen: true,
                type: "error",
                title: t("resetPassword.failedTitle"),
                message: t("resetPassword.userIdMissing"),
            });
            return;
        }

        try {
            setIsSubmitting(true);
            const signature = await requestSignature("Reset temporary password", "User Access Change");
            if (!signature) return;

            const response = await settingsApi.resetPassword(userId, {
                signatureToken: signature.signatureToken,
                reason: signature.reason,
                sendEmail: false,
            });
            const nextPassword = response.password;
            if (!nextPassword) {
                throw new Error("The server did not return a temporary password.");
            }

            onSuccess?.(nextPassword);
            setGeneratedPassword(nextPassword);
        } catch (error) {
            setResultModal({
                isOpen: true,
                type: "error",
                title: t("resetPassword.failedTitle"),
                message: extractApiMessage(error),
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <FormModal
                isOpen={isOpen}
                onClose={onClose}
                onConfirm={generatedPassword ? onClose : handleConfirmReset}
                title={t("resetPassword.title")}
                description={generatedPassword
                    ? t("resetPassword.generatedDescription", { name: userName })
                    : t("resetPassword.initialDescription", { name: userName })}
                confirmText={generatedPassword ? t("common.close") : t("resetPassword.confirm")}
                cancelText={generatedPassword ? undefined : t("common.cancel")}
                size="md"
                isLoading={isSubmitting}
                showCancel={!generatedPassword}
            >
                <div className="space-y-4">
                    <WarningBanner
                        variant="warning"
                        description={generatedPassword
                            ? t("resetPassword.generatedWarning")
                            : t("resetPassword.initialWarning")}
                    />

                    {/* New Password */}
                    {generatedPassword ? (
                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                                {t("resetPassword.temporaryPassword")}
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={generatedPassword}
                                    readOnly
                                    className={CONTROL_STATE_CLASSES.readonlyField}
                                />
                                <Button
                                    type="button"
                                    onClick={handleCopyPassword}
                                    variant="outline"
                                    size="icon-sm"
                                    className="flex h-10 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all duration-200 hover:bg-slate-50"
                                    title={t("resetPassword.copyPassword")}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                            <span>{t("resetPassword.serverGenerated")}</span>
                        </div>
                    )}
                </div>
            </FormModal>

            <AlertModal
                isOpen={resultModal.isOpen}
                onClose={() => setResultModal((prev) => ({ ...prev, isOpen: false }))}
                type={resultModal.type}
                title={resultModal.title}
                description={resultModal.message}
                confirmText={t("common.close")}
                showCancel={false}
            />
            {signatureModal}
        </>
    );
};
