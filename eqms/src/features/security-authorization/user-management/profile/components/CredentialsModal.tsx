import React from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { cn } from "@/components/ui/utils";
import { useToast } from "@/components/ui/toast";
import { IconRefresh } from "@tabler/icons-react";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeCode: string;
  username: string;
  password: string;
  onRegeneratePassword: () => void;
  isRegeneratingPassword?: boolean;
}

export const CredentialsModal: React.FC<CredentialsModalProps> = ({
  isOpen,
  onClose,
  employeeCode,
  username,
  password,
  onRegeneratePassword,
  isRegeneratingPassword = false,
}) => {
  const { showToast } = useToast();

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Login Credentials Generated"
      confirmText="Done"
      showCancel={false}
      size="md"
    >
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Important: Save these login credentials</p>
              <p>
                These credentials can be used to sign in to the system.
                The password is temporary and must be changed on the user's
                first login.
              </p>
            </div>
          </div>
        </div>

        {/* Employee ID */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
            Employee ID
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={employeeCode}
              readOnly
              className={CONTROL_STATE_CLASSES.readonlyField}
            />
            <CopyButton
              text={employeeCode}
              label="Employee ID"
              showToast={showToast}
            />
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
            Username
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={username}
              readOnly
              className={CONTROL_STATE_CLASSES.readonlyField}
            />
            <CopyButton
              text={username}
              label="Username"
              showToast={showToast}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
            Temporary Password
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={password}
              readOnly
              className={CONTROL_STATE_CLASSES.readonlyField}
            />
            <button
              onClick={onRegeneratePassword}
              disabled={isRegeneratingPassword}
              title="Regenerate Password"
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-emerald-300 hover:text-emerald-600 transition-all duration-200 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconRefresh className={cn("h-4 w-4", isRegeneratingPassword && "animate-spin")} />
            </button>
            <CopyButton
              text={password}
              label="Password"
              showToast={showToast}
            />
          </div>
          <p className="text-[11px] sm:text-xs font-normal text-slate-400 flex items-center gap-1">
            Click refresh icon to generate a new temporary password
          </p>
        </div>

        {/* Copy All Button */}
        <Button
        size="sm"
          onClick={async () => {
            const credentials = `Employee ID: ${employeeCode}\nUsername: ${username}\nPassword: ${password}`;
            try {
              if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(credentials);
              } else {
                const textArea = document.createElement("textarea");
                textArea.value = credentials;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand("copy");
                textArea.remove();
                if (!successful) {
                  throw new Error("Fallback copy failed");
                }
              }

              showToast({
                type: "success",
                title: "Copied!",
                message: "All credentials copied to clipboard",
              });
            } catch (err) {
              console.error("Failed to copy credentials:", err);
              showToast({
                type: "error",
                title: "Copy Failed",
                message: "Failed to copy credentials to clipboard",
              });
            }
          }}
          className="w-full flex items-center justify-center gap-2 h-9 px-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-xs font-medium"
        >
          <Copy className="h-4 w-4" />
          Copy All Credentials
        </Button>
      </div>
    </FormModal>
  );
};

// Copy Button Component
const CopyButton: React.FC<{
  text: string;
  label: string;
  showToast: ReturnType<typeof useToast>["showToast"];
}> = ({ text, label, showToast }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        textArea.remove();
        if (!successful) {
          throw new Error("Fallback copy failed");
        }
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast({
        type: "success",
        title: "Copied!",
        message: `${label} copied to clipboard`,
      });
    } catch (err) {
      console.error("Failed to copy text:", err);
      showToast({
        type: "error",
        title: "Copy Failed",
        message: `Failed to copy ${label.toLowerCase()}`,
      });
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center justify-center h-9 w-9 rounded-lg border transition-all duration-200 flex-shrink-0",
        copied
          ? "bg-emerald-50 border-emerald-200 text-emerald-600"
          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
      )}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
};
