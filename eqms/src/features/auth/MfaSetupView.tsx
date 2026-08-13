import React, { useEffect, useRef, useState } from "react";
import { IconCopy, IconCheck, IconMailOpened, IconQrcode, IconRefresh, IconShieldCheck, IconRosetteDiscountCheck, IconDeviceMobile } from "@tabler/icons-react";
import { Smartphone } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button/Button";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { AUTH_UI } from "./auth-ui";
import { AuthBackLink, AuthLayout } from "./components";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { authApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

type MfaMethod = "email" | "app";
type SetupStep = "selection" | "config" | "success";

interface MfaSetupViewProps {
  onComplete?: () => void;
  onBackToLogin?: () => void;
  email?: string;
}

export const MfaSetupView: React.FC<MfaSetupViewProps> = ({
  onComplete,
  onBackToLogin,
  email = "a***n@eqms.com",
}) => {
  const { updateUser } = useAuth();
  const [step, setStep] = useState<SetupStep>("selection");
  const [method, setMethod] = useState<MfaMethod | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeUrl: string; method: string } | null>(null);
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const maskEmail = (emailStr: string) => {
    if (!emailStr || !emailStr.includes("@")) return emailStr;
    const [name, domain] = emailStr.split("@");
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
  };

  useEffect(() => {
    if (step !== "config") return;
    const timer = setTimeout(() => inputRefs.current[0]?.focus(), 250);
    return () => clearTimeout(timer);
  }, [step]);

  const handleMethodSelect = async (selectedMethod: MfaMethod) => {
    setMethod(selectedMethod);
    setError("");
    setOtp(new Array(6).fill(""));
    setStep("config");
    setIsLoading(true);
    try {
      const response = await authApi.setupMFA(selectedMethod);
      setSetupData({ ...response, method: selectedMethod });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to initialize MFA setup.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value)) && value !== "") return;
    const next = [...otp];
    next[index] = value.substring(value.length - 1);
    setOtp(next);
    setError("");
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    const next = [...otp];
    pastedData.forEach((char, index) => {
      next[index] = char;
    });
    setOtp(next);
    inputRefs.current[Math.min(pastedData.length, 5)]?.focus();
  };

  const verifySetup = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the full 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      await authApi.enableMFA({ otp: code, method: method ?? "app" });
      const updatedUser = await authApi.getCurrentUser();
      updateUser(updatedUser);
      setConfirmed(true);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    const textToCopy = setupData?.secret || "";
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const renderSelection = () => (
    <motion.div
      key="selection"
      initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
      className="space-y-6"
    >
      <div className={AUTH_UI.headerArea}>
        <div className={AUTH_UI.headingBlock}>
          <h1 className={AUTH_UI.pageTitle}>Multi-Factor Setup</h1>
          <p className={AUTH_UI.description}>
            Choose how you would like to receive your secure login verification codes.
          </p>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-3">
        <button
          type="button"
          onClick={() => handleMethodSelect("email")}
          className="group flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white p-2.5 text-left transition-colors hover:border-emerald-700/40 hover:bg-emerald-50/30 sm:p-4"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-slate-600"><IconMailOpened size={26} stroke={1.5} /></span>
            <div>
              <p className="text-xs font-semibold text-slate-900 sm:text-sm">Email Authentication</p>
              <p className="text-xs text-slate-500">Receive codes at <span className="font-semibold text-slate-700">{email}</span></p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleMethodSelect("app")}
          className="group flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white p-2.5 text-left transition-colors hover:border-emerald-700/40 hover:bg-emerald-50/30 sm:p-4"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-slate-600"><IconQrcode size={26} stroke={1.5} /></span>
            <div>
              <p className="text-xs font-semibold text-slate-900 sm:text-sm">Authenticator App</p>
              <p className="text-xs text-slate-500">Google Authenticator, Microsoft, Authy, etc.</p>
            </div>
          </div>
        </button>
      </div>

    </motion.div>
  );

  const renderConfig = () => (
    <motion.div
      key="config"
      initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.04 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className={cn(AUTH_UI.headerArea, "mb-1 sm:mb-1")}>
        <div className={AUTH_UI.headingBlock}>
          <h1 className={AUTH_UI.pageTitle}>{method === "app" ? "Scan QR Code" : "Verify Email"}</h1>
          <p className={AUTH_UI.description}>
            {method === "app" ? (
              "Open your authenticator app and scan the code below."
            ) : (
              <span className="sm:whitespace-nowrap">
                We've prepared a code for <span className="font-semibold text-slate-700">{maskEmail(email)}</span>.
              </span>
            )}
          </p>
        </div>
      </div>

      {method === "app" ? (
        <div className="flex flex-col items-center justify-center space-y-4 py-2">
          <div className="relative overflow-hidden rounded-2xl border-4 border-white bg-white transition-transform hover:scale-[1.02]">
            {setupData?.qrCodeUrl ? (
              <div className="flex h-36 w-36 items-center justify-center rounded-lg sm:h-48 sm:w-48">
                <QRCodeSVG value={setupData.qrCodeUrl} size={192} includeMargin />
              </div>
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400 sm:h-48 sm:w-48">
                Loading QR...
              </div>
            )}
            <motion.div
              className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"
              animate={{ top: ["0%", "100%", "0%"], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <code>{setupData?.secret || "Waiting for setup..."}</code>
            <span className="relative flex h-3.5 w-3.5 items-center justify-center">
              <AnimatePresence mode="wait" initial={false}>
                {copied ? <motion.span key="check" className="absolute text-emerald-600"><IconCheck size={14} /></motion.span> : <motion.span key="copy" className="absolute"><IconCopy size={14} /></motion.span>}
              </AnimatePresence>
            </span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-4 py-4">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-inner">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <IconMailOpened size={44} stroke={1.5} />
            </motion.div>
            <motion.div
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-sm"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              OTP
            </motion.div>
          </div>
          <div className="text-center max-w-xs">
            <p className="text-xs text-slate-500 leading-relaxed">
              Please check your inbox. We have sent a 6-digit verification code to your email address.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
            {error}
          </div>
        )}

        <motion.div className="grid grid-cols-6 gap-2 sm:gap-3" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <motion.input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading}
              aria-label={`Verification code digit ${index + 1}`}
              className={cn(
                "otp-input h-16 w-full rounded-[12px] border text-center font-bold outline-none leading-normal transition-all",
                "focus:ring-1 focus:ring-emerald-600",
                digit ? "border-emerald-600 bg-emerald-50/20 text-emerald-900" : "border-slate-200 bg-white focus:border-emerald-600"
              )}
            />
          ))}
        </motion.div>
      </div>

      <Button className={cn(AUTH_UI.submitButton, "mt-4")} onClick={verifySetup} disabled={isLoading || otp.join("").length < 6}>
        Verify & Finalize
      </Button>

      <div className="flex flex-col items-start gap-2 pt-0.5 sm:gap-3 sm:pt-1">
        {method === "email" && (
          <button
            type="button"
            onClick={async () => {
              await handleMethodSelect("email");
            }}
            disabled={isLoading}
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            <IconRefresh size={16} /> Resend Code
          </button>
        )}

        <AuthBackLink
          onClick={() => {
            setStep("selection");
            setSetupData(null);
            setMethod(null);
            setError("");
          }}
          label="Change verification method"
          disabled={isLoading}
        />
      </div>

      {onBackToLogin && (
        <AuthBackLink
          onClick={onBackToLogin}
          label="Back to Sign In"
          disabled={isLoading}
        />
      )}
    </motion.div>
  );

  const renderSuccess = () => (
    <motion.div
      key="success"
      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center space-y-8 py-4 text-center"
    >
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white">
          <IconRosetteDiscountCheck  size={70} />
        </div>
      </div>

      <div className="space-y-3">
        <h1 className={AUTH_UI.pageTitleStrong}>Account Secured</h1>
        <p className="max-w-xs text-sm leading-6 text-slate-500 sm:text-sm sm:leading-7">
          Two-factor authentication has been successfully enabled.
        </p>
      </div>

      <div className="w-full space-y-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-left">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500 p-2 text-white">
              <IconDeviceMobile  size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-800">Primary Method</p>
              <p className="text-sm font-semibold text-emerald-900">
                {method === "app" ? "Authenticator Application" : `Email: ${email}`}
              </p>
            </div>
          </div>
        </div>

        <Button className={cn("w-full py-6 text-lg", AUTH_UI.submitButton)} onClick={onComplete}>
          Continue to System
        </Button>
      </div>
    </motion.div>
  );

  return (
    <>
      {(isLoading && step !== "config") && <FullPageLoading text="Finalizing security setup..." />}
      <AuthLayout
        left={
          <div className={AUTH_UI.formColumn}>
            <div className="mb-6 flex items-center gap-3 text-slate-900 sm:mb-10 lg:mb-12">
              <BrandLogo className="h-8 w-auto object-contain sm:h-9" />
            </div>

            <div className="flex flex-col justify-start">
              <AnimatePresence mode="wait">
                {step === "selection" && renderSelection()}
                {step === "config" && renderConfig()}
                {step === "success" && renderSuccess()}
              </AnimatePresence>
            </div>
          </div>
        }
      />
    </>
  );
};
